from fastapi import APIRouter, Depends

from src.controllers.rooms import ensure_member
from src.db import db
from src.middleware.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/{room_id}")
async def list_messages(room_id: str, user=Depends(get_current_user)):
    await ensure_member(room_id, user.id)
    return await db.message.find_many(
        where={"roomId": room_id},
        include={"sender": True},
        order={"createdAt": "asc"},
        take=100,
    )
