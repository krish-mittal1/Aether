import os
from pathlib import Path
from src.db import db

WORKSPACE_ROOT = Path("/tmp/collab-workspaces")

async def get_file_path(file_id: str) -> str:
    """Build the relative path of a file/folder recursively."""
    parts = []
    current_id = file_id
    while current_id:
        f = await db.file.find_unique(where={"id": current_id})
        if not f:
            break
        parts.insert(0, f.name)
        current_id = f.parentId
    return "/".join(parts)

async def sync_file_to_disk(room_id: str, file_id: str):
    """Write a file or folder from DB to the container filesystem workspace."""
    file = await db.file.find_unique(where={"id": file_id})
    if not file:
        return
    
    rel_path = await get_file_path(file_id)
    dest_path = WORKSPACE_ROOT / room_id / rel_path
    
    if file.type == "folder":
        os.makedirs(dest_path, exist_ok=True)
    else:
        os.makedirs(dest_path.parent, exist_ok=True)
        # Avoid writing if content is None (should not happen for files, but safe check)
        content = file.content or ""
        with open(dest_path, "w", encoding="utf-8") as f:
            f.write(content)

async def delete_file_from_disk(room_id: str, rel_path: str):
    """Delete a file or folder from the container filesystem workspace."""
    dest_path = WORKSPACE_ROOT / room_id / rel_path
    if os.path.exists(dest_path):
        if os.path.isdir(dest_path):
            import shutil
            shutil.rmtree(dest_path, ignore_errors=True)
        else:
            try:
                os.remove(dest_path)
            except OSError:
                pass

async def sync_all_files_to_disk(room_id: str):
    """Synchronize all files in a room to the local container disk."""
    room_dir = WORKSPACE_ROOT / room_id
    os.makedirs(room_dir, exist_ok=True)
    
    files = await db.file.find_many(where={"roomId": room_id})
    # Sort: folders first so that we create parent directories before files
    files.sort(key=lambda x: 0 if x.type == "folder" else 1)
    
    # We will build paths for all files using a fast local cache to avoid N+1 queries
    file_map = {f.id: f for f in files}
    
    def resolve_path(f) -> str:
        parts = []
        curr = f
        while curr:
            parts.insert(0, curr.name)
            curr = file_map.get(curr.parentId) if curr.parentId else None
        return "/".join(parts)
        
    for file in files:
        rel_path = resolve_path(file)
        dest_path = room_dir / rel_path
        if file.type == "folder":
            os.makedirs(dest_path, exist_ok=True)
        else:
            os.makedirs(dest_path.parent, exist_ok=True)
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(file.content or "")
