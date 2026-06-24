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
    def __init__(self, sid: str, term_id: str, room_id: str, sio_server, cols: int = 80, rows: int = 24):
        self.sid = sid
        self.term_id = term_id
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
        workspace_dir = WORKSPACE_ROOT / self.room_id
        os.makedirs(workspace_dir, exist_ok=True)

        self.master_fd, self.slave_fd = pty.openpty()
        self.resize(self.cols, self.rows)

        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["HOME"] = str(workspace_dir)
        env["PWD"] = str(workspace_dir)

        shell = "/bin/bash" if os.path.exists("/bin/bash") else "/bin/sh"

        self.process = subprocess.Popen(
            [shell],
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            cwd=str(workspace_dir),
            env=env,
            preexec_fn=os.setsid,
            close_fds=True,
        )

        os.close(self.slave_fd)
        self.slave_fd = None

        self.read_task = asyncio.create_task(self._read_loop())
        logger.info("Terminal started sid=%s termId=%s room=%s", self.sid, self.term_id, self.room_id)

    async def _read_loop(self):
        try:
            while self.process and self.process.poll() is None:
                data = await self.loop.run_in_executor(None, self._read_fd)
                if not data:
                    break
                await self.sio.emit(
                    "terminal_output",
                    {"data": data.decode("utf-8", errors="replace"), "termId": self.term_id},
                    to=self.sid,
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Terminal read error sid=%s termId=%s: %s", self.sid, self.term_id, e)
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
                size = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, size)
            except Exception as e:
                logger.error("Terminal resize failed: %s", e)

    async def stop(self):
        if self.read_task:
            self.read_task.cancel()
            self.read_task = None

        if self.process:
            if self.process.poll() is None:
                try:
                    self.process.terminate()
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

        try:
            await self.sio.emit("terminal_closed", {"termId": self.term_id}, to=self.sid)
        except Exception:
            pass
        logger.info("Terminal stopped sid=%s termId=%s", self.sid, self.term_id)


class TerminalManager:
    def __init__(self, sio_server):
        self.sio = sio_server
        self.sessions: Dict[str, TerminalSession] = {}

    def _key(self, sid: str, term_id: str) -> str:
        return f"{sid}:{term_id}"

    async def create_session(self, sid: str, term_id: str, room_id: str, cols: int = 80, rows: int = 24) -> TerminalSession:
        key = self._key(sid, term_id)
        await self._close_key(key)
        session = TerminalSession(sid, term_id, room_id, self.sio, cols, rows)
        self.sessions[key] = session
        await session.start()
        return session

    async def write_to_session(self, sid: str, term_id: str, data: str):
        session = self.sessions.get(self._key(sid, term_id))
        if session:
            await session.write(data)

    def resize_session(self, sid: str, term_id: str, cols: int, rows: int):
        session = self.sessions.get(self._key(sid, term_id))
        if session:
            session.resize(cols, rows)

    async def close_session(self, sid: str, term_id: str):
        await self._close_key(self._key(sid, term_id))

    async def close_all_for_sid(self, sid: str):
        prefix = f"{sid}:"
        keys = [k for k in list(self.sessions) if k.startswith(prefix)]
        for key in keys:
            await self._close_key(key)

    async def _close_key(self, key: str):
        session = self.sessions.pop(key, None)
        if session:
            await session.stop()


# Initialized in events.py
terminal_manager = None
