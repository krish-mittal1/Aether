import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.middleware.auth import get_current_user
from src.utils.workspace import WORKSPACE_ROOT, sync_all_files_to_disk

logger = logging.getLogger("collab-git")

router = APIRouter(prefix="/git", tags=["git"])

_GIT_TIMEOUT = 10.0


async def _run_git(room_id: str, *args: str) -> tuple[str, str, int]:
    workspace_dir = WORKSPACE_ROOT / room_id
    if not workspace_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace not found. Save files first.")
    try:
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=str(workspace_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=_GIT_TIMEOUT)
        return stdout.decode(errors="replace"), stderr.decode(errors="replace"), proc.returncode
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="git is not installed on this server")
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="git command timed out")


def _is_initialized(room_id: str) -> bool:
    return (WORKSPACE_ROOT / room_id / ".git").exists()


@router.post("/{room_id}/init")
async def git_init(room_id: str, user=Depends(get_current_user)):
    await sync_all_files_to_disk(room_id)
    stdout, stderr, code = await _run_git(room_id, "init")
    if code != 0:
        raise HTTPException(status_code=500, detail=stderr.strip() or "git init failed")
    # Set a local identity so commits don't fail
    await _run_git(room_id, "config", "user.email", "collab@aether.dev")
    await _run_git(room_id, "config", "user.name", "Aether Collab")
    await _run_git(room_id, "config", "core.autocrlf", "input")
    return {"message": stdout.strip() or "Initialized empty repository", "initialized": True}


@router.get("/{room_id}/status")
async def git_status(room_id: str, _=Depends(get_current_user)):
    if not _is_initialized(room_id):
        return {"initialized": False, "files": [], "branch": None}

    stdout, _, _ = await _run_git(room_id, "status", "--short", "--branch")
    files = []
    branch = None
    for line in stdout.strip().splitlines():
        if line.startswith("##"):
            # ## main...origin/main [ahead 1] or ## No commits yet on main
            branch_part = line[3:].split("...")[0].strip()
            branch = branch_part.replace("No commits yet on ", "").strip()
        elif len(line) >= 3:
            status = line[:2].strip()
            path = line[3:].strip()
            files.append({"status": status, "path": path})
    return {"initialized": True, "files": files, "branch": branch or "main"}


@router.get("/{room_id}/diff")
async def git_diff(room_id: str, _=Depends(get_current_user)):
    if not _is_initialized(room_id):
        raise HTTPException(status_code=400, detail="Repository not initialized. Run git init first.")
    stdout, _, _ = await _run_git(room_id, "diff", "--stat")
    full_diff, _, _ = await _run_git(room_id, "diff")
    staged, _, _ = await _run_git(room_id, "diff", "--staged")
    return {
        "stat": stdout.strip(),
        "diff": full_diff[:50_000],
        "staged": staged[:50_000],
    }


@router.get("/{room_id}/log")
async def git_log(room_id: str, _=Depends(get_current_user)):
    if not _is_initialized(room_id):
        return {"commits": []}
    stdout, _, code = await _run_git(
        room_id, "log", "--oneline", "--decorate", "-25"
    )
    if code != 0:
        return {"commits": []}
    commits = []
    for line in stdout.strip().splitlines():
        parts = line.split(" ", 1)
        if len(parts) == 2:
            commits.append({"hash": parts[0], "message": parts[1]})
    return {"commits": commits}


class CommitBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)
    author: str = "Aether User"


@router.post("/{room_id}/commit")
async def git_commit(room_id: str, body: CommitBody, user=Depends(get_current_user)):
    if not _is_initialized(room_id):
        raise HTTPException(status_code=400, detail="Repository not initialized. Run git init first.")
    await sync_all_files_to_disk(room_id)

    _, add_err, add_code = await _run_git(room_id, "add", "-A")
    if add_code != 0:
        raise HTTPException(status_code=500, detail=f"git add failed: {add_err.strip()}")

    author_str = f"{body.author} <collab@aether.dev>"
    _, commit_err, commit_code = await _run_git(
        room_id, "commit", "-m", body.message, "--author", author_str
    )
    if commit_code != 0:
        err = commit_err.strip()
        if "nothing to commit" in err:
            raise HTTPException(status_code=400, detail="Nothing to commit — working tree is clean.")
        raise HTTPException(status_code=500, detail=f"git commit failed: {err}")

    hash_out, _, _ = await _run_git(room_id, "rev-parse", "--short", "HEAD")
    return {"message": "Committed successfully", "hash": hash_out.strip()}
