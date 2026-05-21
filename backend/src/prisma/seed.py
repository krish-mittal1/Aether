import asyncio

from src.db import connect_db, db, disconnect_db
from src.utils.security import hash_password


async def main():
    await connect_db()
    user = await db.user.upsert(
        where={"email": "demo@example.com"},
        data={
            "create": {
                "username": "demo",
                "email": "demo@example.com",
                "password": hash_password("password123"),
                "avatar": "https://api.dicebear.com/9.x/initials/svg?seed=demo",
            },
            "update": {},
        },
    )
    room = await db.room.create(data={"name": "Demo Workspace", "ownerId": user.id})
    await db.roommember.upsert(
        where={"userId_roomId": {"userId": user.id, "roomId": room.id}},
        data={
            "create": {"userId": user.id, "roomId": room.id, "role": "owner"},
            "update": {},
        },
    )
    await db.file.create(
        data={
            "roomId": room.id,
            "name": "main.py",
            "type": "file",
            "language": "python",
            "content": "name = 'collab'\nprint(f'Hello, {name}!')\n",
            "version": 1,
        }
    )
    print(f"Seeded: user={user.email}, room={room.id}")
    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
