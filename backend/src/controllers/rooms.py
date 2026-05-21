from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.db import db
from src.middleware.auth import get_current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


class CreateRoomBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JoinRoomBody(BaseModel):
    roomId: str


async def ensure_member(room_id: str, user_id: str) -> None:
    member = await db.roommember.find_unique(where={"userId_roomId": {"userId": user_id, "roomId": room_id}})
    if not member:
        raise HTTPException(status_code=403, detail="Not a room member")


async def ensure_room_writer(room_id: str, user_id: str) -> None:
    member = await db.roommember.find_unique(where={"userId_roomId": {"userId": user_id, "roomId": room_id}})
    if not member:
        raise HTTPException(status_code=403, detail="Not a room member")
    if member.role not in {"owner", "editor", "member"}:
        raise HTTPException(status_code=403, detail="Insufficient room permissions")


@router.post("")
async def create_room(body: CreateRoomBody, user=Depends(get_current_user)):
    room = await db.room.create(data={"name": body.name, "ownerId": user.id})
    await db.roommember.create(data={"roomId": room.id, "userId": user.id, "role": "owner"})
    await db.file.create(
        data={
            "roomId": room.id,
            "name": "main.py",
            "type": "file",
            "language": "python",
            "content": "print('Hello from Collab Code Editor')\n",
            "version": 1,
        }
    )
    return room


@router.get("")
async def list_rooms(user=Depends(get_current_user)):
    memberships = await db.roommember.find_many(
        where={"userId": user.id},
        include={"room": True},
        order={"createdAt": "desc"},
    )
    return [m.room for m in memberships]


@router.get("/{room_id}")
async def get_room(room_id: str, user=Depends(get_current_user)):
    await ensure_member(room_id, user.id)
    room = await db.room.find_unique(where={"id": room_id}, include={"members": {"include": {"user": True}}})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("/join")
async def join_room(body: JoinRoomBody, user=Depends(get_current_user)):
    room = await db.room.find_unique(where={"id": body.roomId})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    await db.roommember.upsert(
        where={"userId_roomId": {"userId": user.id, "roomId": body.roomId}},
        data={"create": {"userId": user.id, "roomId": body.roomId, "role": "member"}, "update": {}},
    )
    return room


@router.delete("/{room_id}")
async def delete_room(room_id: str, user=Depends(get_current_user)):
    room = await db.room.find_unique(where={"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.ownerId != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this room")

    # Delete children in dependency order to avoid FK constraint errors
    # 1. FileVersions (depend on Files)
    files = await db.file.find_many(where={"roomId": room_id})
    for file in files:
        await db.fileversion.delete_many(where={"fileId": file.id})

    # 2. Files
    await db.file.delete_many(where={"roomId": room_id})

    # 3. Messages
    await db.message.delete_many(where={"roomId": room_id})

    # 4. RoomMembers
    await db.roommember.delete_many(where={"roomId": room_id})

    # 5. Room itself
    await db.room.delete(where={"id": room_id})

    return {"ok": True}

