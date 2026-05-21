import os
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

try:
    import resource
except ImportError:
    resource = None

app = FastAPI(title="Collab Code Executor")

MAX_CODE_BYTES = 128 * 1024
MAX_STDIN_BYTES = 64 * 1024
TIMEOUT_SECONDS = int(os.getenv("EXECUTION_TIMEOUT_SECONDS", "5"))
EXECUTION_TMP_ROOT = os.getenv("EXECUTION_TMP_ROOT")
OUTPUT_LIMIT = 20000
BANNED_PATTERNS = {
    "python": ["import socket", "subprocess", "os.system", "shutil.rmtree", "open('/etc", 'open("/etc'],
    "javascript": ["child_process", "require('fs')", 'require("fs")', "process.exit"],
    "typescript": ["child_process", "require('fs')", 'require("fs")', "process.exit"],
    "cpp": ["#include <sys/socket", "fork(", "system(", "popen("],
    "java": ["Runtime.exec", "ProcessBuilder", "System.exit", "java.net.Socket"],
}


class ExecuteRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""


def run_command(cmd: list[str], cwd: Path, stdin: str = "") -> tuple[str, str, int, float]:
    started = time.perf_counter()
    child_env = os.environ.copy()
    child_env.update({"HOME": str(cwd), "TMPDIR": str(cwd), "TEMP": str(cwd), "TMP": str(cwd)})
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            input=stdin,
            text=True,
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            env=child_env,
            preexec_fn=limit_child if os.name != "nt" else None,
        )
    except subprocess.TimeoutExpired as exc:
        elapsed = (time.perf_counter() - started) * 1000
        return (exc.stdout or "")[-OUTPUT_LIMIT:], f"Execution timed out after {TIMEOUT_SECONDS}s", 124, elapsed
    elapsed = (time.perf_counter() - started) * 1000
    return proc.stdout[-OUTPUT_LIMIT:], proc.stderr[-OUTPUT_LIMIT:], proc.returncode, elapsed


def make_workdir() -> Path:
    if EXECUTION_TMP_ROOT:
        root = Path(EXECUTION_TMP_ROOT)
        root.mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix=f"run-{uuid.uuid4().hex}-", dir=root))
    return Path(tempfile.mkdtemp(prefix=f"run-{uuid.uuid4().hex}-"))


def limit_child() -> None:
    if resource is None:
        return
    resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT_SECONDS + 1, TIMEOUT_SECONDS + 1))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 * 1024, 2 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def reject_dangerous_code(language: str, code: str) -> None:
    lowered = code.lower()
    for pattern in BANNED_PATTERNS.get(language, []):
        if pattern.lower() in lowered:
            raise HTTPException(status_code=400, detail=f"Disallowed code pattern: {pattern}")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/execute")
async def execute(body: ExecuteRequest):
    if len(body.code.encode("utf-8")) > MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="Code too large")
    if len(body.stdin.encode("utf-8")) > MAX_STDIN_BYTES:
        raise HTTPException(status_code=413, detail="stdin too large")
    language = body.language.lower()
    reject_dangerous_code(language, body.code)
    workdir = make_workdir()
    try:
        if language in {"python", "py"}:
            source = workdir / "main.py"
            source.write_text(body.code, encoding="utf-8")
            cmd = [sys.executable if os.name == "nt" else "python3", str(source)]
        elif language in {"javascript", "js"}:
            source = workdir / "main.js"
            source.write_text(body.code, encoding="utf-8")
            cmd = ["node", str(source)]
        elif language in {"typescript", "ts"}:
            source = workdir / "main.ts"
            source.write_text(body.code, encoding="utf-8")
            # Try to transpile with npx ts-node or esbuild; fall back to stripping types
            if shutil.which("npx"):
                ts_out = workdir / "main.js"
                compile_out, compile_err, compile_code, compile_ms = run_command(
                    ["npx", "--yes", "esbuild", "--bundle=false", f"--outfile={ts_out}", str(source)], workdir
                )
                if compile_code != 0:
                    return {"output": compile_out, "error": compile_err, "exitCode": compile_code, "executionTimeMs": round(compile_ms, 2)}
                cmd = ["node", str(ts_out)]
            else:
                # Basic fallback: run as JS (works for most TS without decorators)
                cmd = ["node", str(source)]
        elif language in {"cpp", "c++"}:
            source = workdir / "main.cpp"
            binary = workdir / "main"
            source.write_text(body.code, encoding="utf-8")
            compile_out, compile_err, compile_code, compile_ms = run_command(["g++", "-O2", "-std=c++17", str(source), "-o", str(binary)], workdir)
            if compile_code != 0:
                return {"output": compile_out, "error": compile_err, "exitCode": compile_code, "executionTimeMs": round(compile_ms, 2)}
            cmd = [str(binary)]
        elif language == "java":
            # Java requires the file name to match the public class name
            import re
            match = re.search(r"public\s+class\s+(\w+)", body.code)
            class_name = match.group(1) if match else "Main"
            source = workdir / f"{class_name}.java"
            source.write_text(body.code, encoding="utf-8")
            compile_out, compile_err, compile_code, compile_ms = run_command(
                ["javac", str(source)], workdir
            )
            if compile_code != 0:
                return {"output": compile_out, "error": compile_err, "exitCode": compile_code, "executionTimeMs": round(compile_ms, 2)}
            cmd = ["java", "-cp", str(workdir), class_name]
        else:
            raise HTTPException(status_code=400, detail="Unsupported language")

        output, error, exit_code, elapsed_ms = run_command(cmd, workdir, body.stdin)
        return {"output": output, "error": error, "exitCode": exit_code, "executionTimeMs": round(elapsed_ms, 2)}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
