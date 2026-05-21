import os
import pty
import struct
import fcntl
import termios
import asyncio
import subprocess
from pathlib import Path
from typing import Dict
import logging

logger = logging.getLogger("terminal-service")

WORKSPACE_ROOT = Path("/tmp/collab-workspaces")

class TerminalSession:
    def __init__(self, sid: str, room_id: str, sio_server, cols: int = 80, rows: int = 24):
        self.sid = sid
        self.room_id = room_id
        self.sio = sio_server
        self.cols = cols
        self.rows = rows
        
        self.master_fd = None
        self.slave_fd = None
        self.process = None
        self.read_task = None
        self.loop = asyncio.get_running_loop()

    async def start(self):
        # Resolve workspace directory
        workspace_dir = WORKSPACE_ROOT / self.room_id
        os.makedirs(workspace_dir, exist_ok=True)
        
        # Create PTY
        self.master_fd, self.slave_fd = pty.openpty()
        
        # Set size
        self.resize(self.cols, self.rows)
        
        # Set environment variables
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["HOME"] = str(workspace_dir)
        env["PWD"] = str(workspace_dir)
        
        # We prefer bash, fallback to sh
        shell = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"
        
        # Spawn process
        self.process = subprocess.Popen(
            [shell],
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            cwd=str(workspace_dir),
            env=env,
            preexec_fn=os.setsid,
            close_fds=True
        )
        
        # Close slave fd in parent process as we only use master fd
        os.close(self.slave_fd)
        self.slave_fd = None
        
        # Start reading output
        self.read_task = asyncio.create_task(self._read_output_loop())
        logger.info(f"Started terminal process for sid={self.sid} in room={self.room_id}")

    async def _read_output_loop(self):
        try:
            while self.process and self.process.poll() is None:
                # Use executor to read from the master fd without blocking the event loop
                data = await self.loop.run_in_executor(None, self._read_fd)
                if not data:
                    break
                # Emit output to client
                await self.sio.emit("terminal_output", {"data": data.decode("utf-8", errors="replace")}, to=self.sid)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error reading from terminal master fd: {e}")
        finally:
            await self.stop()

    def _read_fd(self) -> bytes:
        try:
            return os.read(self.master_fd, 4096)
        except OSError:
            return b""

    async def write(self, data: str):
        if self.master_fd is not None:
            try:
                await self.loop.run_in_executor(None, os.write, self.master_fd, data.encode("utf-8"))
            except OSError:
                pass

    def resize(self, cols: int, rows: int):
        self.cols = cols
        self.rows = rows
        if self.master_fd is not None:
            try:
                # Set terminal size using ioctl
                size = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, size)
            except Exception as e:
                logger.error(f"Failed to resize terminal master fd: {e}")

    async def stop(self):
        if self.read_task:
            self.read_task.cancel()
            self.read_task = None
            
        if self.process:
            if self.process.poll() is None:
                try:
                    self.process.terminate()
                    # Wait briefly for process to terminate
                    for _ in range(10):
                        if self.process.poll() is not None:
                            break
                        await asyncio.sleep(0.05)
                    if self.process.poll() is None:
                        self.process.kill()
                except Exception:
                    pass
            self.process = None
            
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None
            
        # Emit a closed event to the client
        await self.sio.emit("terminal_closed", {}, to=self.sid)
        logger.info(f"Stopped terminal process for sid={self.sid}")

class TerminalManager:
    def __init__(self, sio_server):
        self.sio = sio_server
        self.sessions: Dict[str, TerminalSession] = {}

    async def create_session(self, sid: str, room_id: str, cols: int = 80, rows: int = 24) -> TerminalSession:
        await self.close_session(sid)
        session = TerminalSession(sid, room_id, self.sio, cols, rows)
        self.sessions[sid] = session
        await session.start()
        return session

    async def write_to_session(self, sid: str, data: str):
        session = self.sessions.get(sid)
        if session:
            await session.write(data)

    def resize_session(self, sid: str, cols: int, rows: int):
        session = self.sessions.get(sid)
        if session:
            session.resize(cols, rows)

    async def close_session(self, sid: str):
        session = self.sessions.pop(sid, None)
        if session:
            await session.stop()

# Global terminal manager placeholder, initialized in main/events
terminal_manager = None
