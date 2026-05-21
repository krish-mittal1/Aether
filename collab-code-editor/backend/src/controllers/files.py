from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from typing import Dict, Optional, Tuple

from src.controllers.rooms import ensure_member, ensure_room_writer
from src.db import db
from src.middleware.auth import get_current_user

router = APIRouter(prefix="/files", tags=["files"])


class CreateFileBody(BaseModel):
    roomId: str
    parentId: Optional[str] = None
    name: str = Field(min_length=1, max_length=128)
    type: str = Field(pattern="^(file|folder)$")
    language: str = "javascript"
    content: str = ""


class UpdateFileBody(BaseModel):
    name: Optional[str] = None
    parentId: Optional[str] = None
    content: Optional[str] = None
    language: Optional[str] = None
    baseVersion: Optional[int] = None


class ImportFileItem(BaseModel):
    path: str = Field(min_length=1, max_length=512)
    content: str = Field(max_length=25_000_000)  # 25 MB per file
    language: str = "javascript"


class ImportFolderBody(BaseModel):
    roomId: str
    files: list[ImportFileItem] = Field(min_length=1, max_length=50_000)  # up to 50,000 files


def normalize_path(path: str) -> list[str]:
    parts = [part.strip() for part in path.replace("\\", "/").split("/") if part.strip()]
    if not parts or any(part in {".", ".."} for part in parts):
        raise HTTPException(status_code=400, detail=f"Invalid import path: {path}")
    return parts


@router.post("/import-folder")
async def import_folder(body: ImportFolderBody, user=Depends(get_current_user)):
    await ensure_room_writer(body.roomId, user.id)
    total_bytes = sum(len(item.content.encode("utf-8")) for item in body.files)
    if total_bytes > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imported folder exceeds 500MB. Try importing a smaller subfolder.")

    existing = await db.file.find_many(where={"roomId": body.roomId})
    folder_cache: Dict[Tuple[Optional[str], str], str] = {
        (item.parentId, item.name): item.id for item in existing if item.type == "folder"
    }
    created_or_updated = []

    for item in body.files:
        parts = normalize_path(item.path)
        parent_id = None

        for folder_name in parts[:-1]:
            cache_key = (parent_id, folder_name)
            if cache_key not in folder_cache:
                folder = await db.file.find_first(
                    where={"roomId": body.roomId, "parentId": parent_id, "name": folder_name, "type": "folder"}
                )
                if not folder:
                    folder = await db.file.create(
                        data={
                            "roomId": body.roomId,
                            "parentId": parent_id,
                            "name": folder_name,
                            "type": "folder",
                            "content": "",
                            "language": "text",
                            "version": 1,
                        }
                    )
                folder_cache[cache_key] = folder.id
                # Always track the folder so it appears in the response
                if not any(f.id == folder.id for f in created_or_updated):
                    created_or_updated.append(folder)
            parent_id = folder_cache[cache_key]

        file_name = parts[-1]
        existing_file = await db.file.find_first(
            where={"roomId": body.roomId, "parentId": parent_id, "name": file_name}
        )
        next_version = (existing_file.version + 1) if existing_file else 1
        if existing_file:
            imported_file = await db.file.update(
                where={"id": existing_file.id},
                data={
                    "type": "file",
                    "content": item.content,
                    "language": item.language,
                    "version": next_version,
                },
            )
        else:
            imported_file = await db.file.create(
                data={
                    "roomId": body.roomId,
                    "parentId": parent_id,
                    "name": file_name,
                    "type": "file",
                    "content": item.content,
                    "language": item.language,
                    "version": next_version,
                }
            )
        existing_version = await db.fileversion.find_unique(
            where={"fileId_version": {"fileId": imported_file.id, "version": next_version}}
        )
        if not existing_version:
            await db.fileversion.create(
                data={"fileId": imported_file.id, "userId": user.id, "version": next_version, "content": item.content}
            )
        created_or_updated.append(imported_file)

    all_files = await db.file.find_many(where={"roomId": body.roomId}, order={"createdAt": "asc"})
    return {"count": len(body.files), "files": all_files}


@router.get("/{room_id}")
async def list_files(room_id: str, user=Depends(get_current_user)):
    await ensure_member(room_id, user.id)
    # Return metadata only (no content) for fast initial load.
    # Content is fetched on demand when a file is opened.
    files = await db.file.find_many(where={"roomId": room_id}, order={"createdAt": "asc"})
    return [
        {
            "id": f.id,
            "roomId": f.roomId,
            "parentId": f.parentId,
            "name": f.name,
            "type": f.type,
            "language": f.language,
            "version": f.version,
            "createdAt": f.createdAt,
            "updatedAt": f.updatedAt,
            # Only include content for small files (< 10KB) to avoid slow payloads
            "content": f.content if f.type == "folder" or len(f.content or "") < 10_000 else None,
        }
        for f in files
    ]


@router.get("/{room_id}/content/{file_id}")
async def get_file_content(room_id: str, file_id: str, user=Depends(get_current_user)):
    """Fetch full content of a single file on demand (for lazy loading)."""
    await ensure_member(room_id, user.id)
    file = await db.file.find_unique(where={"id": file_id})
    if not file or file.roomId != room_id:
        raise HTTPException(status_code=404, detail="File not found")
    return {"id": file.id, "content": file.content, "version": file.version}


@router.post("")
async def create_file(body: CreateFileBody, user=Depends(get_current_user)):
    await ensure_room_writer(body.roomId, user.id)
    data = body.model_dump()
    if data["type"] == "folder":
        data["content"] = ""
    data["version"] = 1
    return await db.file.create(data=data)


@router.patch("/{file_id}")
async def update_file(file_id: str, body: UpdateFileBody, user=Depends(get_current_user)):
    file = await db.file.find_unique(where={"id": file_id})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    await ensure_room_writer(file.roomId, user.id)
    body_data = body.model_dump()
    base_version = body_data.pop("baseVersion", None)
    data = {k: v for k, v in body_data.items() if v is not None}
    if "parentId" in body_data:
        data["parentId"] = body_data["parentId"]
    if "parentId" in data:
        if data["parentId"] == file.id:
            raise HTTPException(status_code=400, detail="Cannot move a folder into itself")
        if data["parentId"]:
            parent = await db.file.find_unique(where={"id": data["parentId"]})
            if not parent or parent.roomId != file.roomId or parent.type != "folder":
                raise HTTPException(status_code=400, detail="Invalid destination folder")
            current = parent
            while current.parentId:
                if current.parentId == file.id:
                    raise HTTPException(status_code=400, detail="Cannot move a folder into its own child")
                current = await db.file.find_unique(where={"id": current.parentId})
                if not current:
                    break
    if "content" in data:
        if data["content"] == file.content:
            return file
        if base_version is not None and base_version < file.version:
            raise HTTPException(
                status_code=409,
                detail={"message": "File changed on the server", "file": jsonable_encoder(file)},
            )
        data["version"] = file.version + 1
        await db.fileversion.create(
            data={
                "fileId": file.id,
                "userId": user.id,
                "version": file.version + 1,
                "content": data["content"],
            }
        )
    return await db.file.update(where={"id": file_id}, data=data)


@router.delete("/{file_id}")
async def delete_file(file_id: str, user=Depends(get_current_user)):
    file = await db.file.find_unique(where={"id": file_id})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    await ensure_room_writer(file.roomId, user.id)
    await db.file.delete(where={"id": file_id})
    return {"ok": True}


@router.get("/{file_id}/versions")
async def list_file_versions(file_id: str, user=Depends(get_current_user)):
    file = await db.file.find_unique(where={"id": file_id})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    await ensure_member(file.roomId, user.id)
    return await db.fileversion.find_many(where={"fileId": file_id}, order={"createdAt": "desc"}, take=25)
