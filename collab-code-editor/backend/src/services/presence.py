import json
from typing import Any, Dict, List, Optional

import redis.asyncio as redis

from src.config import settings


class PresenceService:
    def __init__(self):
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)

    async def join(self, room_id: str, user: dict[str, Any], sid: str) -> list[dict[str, Any]]:
        await self.redis.hset(f"room:{room_id}:users", user["id"], json.dumps({**user, "sid": sid}))
        await self.redis.set(f"socket:{sid}:user", json.dumps({"roomId": room_id, **user}), ex=3600)
        return await self.room_users(room_id)

    async def leave(self, room_id: str, user_id: str, sid: Optional[str] = None) -> List[Dict[str, Any]]:
        await self.redis.hdel(f"room:{room_id}:users", user_id)
        if sid:
            await self.redis.delete(f"socket:{sid}:user")
        return await self.room_users(room_id)

    async def room_users(self, room_id: str) -> list[dict[str, Any]]:
        raw = await self.redis.hvals(f"room:{room_id}:users")
        return [json.loads(item) for item in raw]

    async def socket_user(self, sid: str) -> Optional[Dict[str, Any]]:
        raw = await self.redis.get(f"socket:{sid}:user")
        return json.loads(raw) if raw else None

    async def close(self) -> None:
        await self.redis.aclose()


presence = PresenceService()
