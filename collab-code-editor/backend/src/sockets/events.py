import logging
from datetime import datetime, timezone

import socketio
from fastapi.encoders import jsonable_encoder

from src.config import settings
from src.controllers.auth import serialize_user
from src.db import db
from src.services.presence import presence
from src.utils.security import decode_access_token

logger = logging.getLogger("collab-socket")

from src.utils.workspace import sync_file_to_disk, delete_file_from_disk, sync_all_files_to_disk, get_file_path
import src.services.terminal as terminal_module


CORS_ORIGINS = [o.strip() for o in settings.cors_origins.split(",")] or "*"

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)

terminal_module.terminal_manager = terminal_module.TerminalManager(sio)
terminal_manager = terminal_module.terminal_manager



async def socket_user_from_token(environ, auth):
    token = (auth or {}).get("token")
    if not token:
        header = environ.get("HTTP_AUTHORIZATION", "")
        token = header.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    user = await db.user.find_unique(where={"id": payload["sub"]})
    if not user:
        raise ConnectionRefusedError("User not found")
    return user


async def is_member(room_id: str, user_id: str) -> bool:
    member = await db.roommember.find_unique(where={"userId_roomId": {"userId": user_id, "roomId": room_id}})
    return member is not None


async def ensure_socket_member(sid: str, room_id: str, user_id: str) -> bool:
    if await is_member(room_id, user_id):
        return True
    await sio.emit("error-message", {"message": "Not a room member"}, to=sid)
    return False


@sio.event
async def connect(sid, environ, auth):
    try:
        user = await socket_user_from_token(environ, auth)
    except Exception as exc:
        logger.warning("socket rejected: %s", exc)
        raise ConnectionRefusedError("Unauthorized")
    await sio.save_session(sid, {"user": serialize_user(user)})
    logger.info("socket connected sid=%s user=%s", sid, user.username)


@sio.event
async def disconnect(sid):
    await terminal_manager.close_session(sid)
    stored = await presence.socket_user(sid)
    if stored:
        room_id = stored["roomId"]
        users = await presence.leave(room_id, stored["id"], sid)
        await sio.emit("user-left", {"userId": stored["id"], "users": users}, room=room_id, skip_sid=sid)
    logger.info("socket disconnected sid=%s", sid)


@sio.event
async def join_room(sid, data):
    session = await sio.get_session(sid)
    user = session["user"]
    room_id = data["roomId"]
    if not await ensure_socket_member(sid, room_id, user["id"]):
        return
    await sio.enter_room(sid, room_id)
    users = await presence.join(room_id, user, sid)
    await sio.emit("user-joined", {"user": user, "users": users}, room=room_id)
    await sio.emit("room-users", {"users": users}, to=sid)
    try:
        await sync_all_files_to_disk(room_id)
    except Exception as e:
        logger.error(f"Failed to sync workspace to disk for room {room_id}: {e}")


@sio.on("join-room")
async def join_room_alias(sid, data):
    await join_room(sid, data)


@sio.event
async def leave_room(sid, data):
    session = await sio.get_session(sid)
    user = session["user"]
    room_id = data["roomId"]
    await sio.leave_room(sid, room_id)
    users = await presence.leave(room_id, user["id"], sid)
    await sio.emit("user-left", {"userId": user["id"], "users": users}, room=room_id)


@sio.on("leave-room")
async def leave_room_alias(sid, data):
    await leave_room(sid, data)


@sio.event
async def code_change(sid, data):
    session = await sio.get_session(sid)
    file_id = data["fileId"]
    content = data["content"]
    file = await db.file.find_unique(where={"id": file_id})
    if not file:
        return
    if not await ensure_socket_member(sid, file.roomId, session["user"]["id"]):
        return
    if content == file.content:
        await sio.emit("code-ack", {"fileId": file_id, "version": file.version}, to=sid)
        return
    base_version = data.get("baseVersion")
    if base_version is not None and int(base_version) < file.version:
        await sio.emit(
            "code-conflict",
            {"fileId": file_id, "serverFile": jsonable_encoder(file), "message": "Your local file was behind the server version."},
            to=sid,
        )
        return
    next_version = file.version + 1
    existing_version = await db.fileversion.find_unique(
        where={"fileId_version": {"fileId": file_id, "version": next_version}}
    )
    if not existing_version:
        await db.fileversion.create(
            data={
                "fileId": file_id,
                "userId": session["user"]["id"],
                "version": next_version,
                "content": content,
            }
        )
    updated = await db.file.update(where={"id": file_id}, data={"content": content, "version": next_version})
    await sio.emit(
        "code-updated",
        {
            "fileId": file_id,
            "content": content,
            "version": updated.version,
            "userId": session["user"]["id"],
            "versionAt": datetime.now(timezone.utc).isoformat(),
        },
        room=file.roomId,
        skip_sid=sid,
    )
    await sio.emit("code-ack", {"fileId": file_id, "version": updated.version}, to=sid)
    try:
        await sync_file_to_disk(file.roomId, file_id)
    except Exception as e:
        logger.error(f"Failed to sync file {file_id} to disk: {e}")



@sio.on("code-change")
async def code_change_alias(sid, data):
    await code_change(sid, data)


@sio.event
async def cursor_change(sid, data):
    session = await sio.get_session(sid)
    if not await ensure_socket_member(sid, data["roomId"], session["user"]["id"]):
        return
    await sio.emit("cursor-updated", {**data, "user": session["user"]}, room=data["roomId"], skip_sid=sid)


@sio.on("cursor-change")
async def cursor_change_alias(sid, data):
    await cursor_change(sid, data)


@sio.event
async def typing(sid, data):
    session = await sio.get_session(sid)
    if not await ensure_socket_member(sid, data["roomId"], session["user"]["id"]):
        return
    await sio.emit("user-typing", {**data, "user": session["user"]}, room=data["roomId"], skip_sid=sid)


@sio.event
async def send_message(sid, data):
    session = await sio.get_session(sid)
    if not await ensure_socket_member(sid, data["roomId"], session["user"]["id"]):
        return
    message = await db.message.create(
        data={"roomId": data["roomId"], "senderId": session["user"]["id"], "content": data["content"]},
        include={"sender": True},
    )
    await sio.emit("receive-message", jsonable_encoder(message), room=data["roomId"])


@sio.on("send-message")
async def send_message_alias(sid, data):
    await send_message(sid, data)


@sio.event
async def create_file(sid, data):
    session = await sio.get_session(sid)
    if not await ensure_socket_member(sid, data["roomId"], session["user"]["id"]):
        return
    file = await db.file.create(
        data={
            "roomId": data["roomId"],
            "parentId": data.get("parentId"),
            "name": data["name"],
            "type": data.get("type", "file"),
            "language": data.get("language", "javascript"),
            "content": "" if data.get("type") == "folder" else data.get("content", ""),
            "version": 1,
        }
    )
    await sio.emit("file-created", {"file": jsonable_encoder(file), "user": session["user"]}, room=data["roomId"])
    try:
        await sync_file_to_disk(data["roomId"], file.id)
    except Exception as e:
        logger.error(f"Failed to sync created file {file.id}: {e}")



@sio.on("create-file")
async def create_file_alias(sid, data):
    await create_file(sid, data)


@sio.event
async def delete_file(sid, data):
    session = await sio.get_session(sid)
    file = await db.file.find_unique(where={"id": data["fileId"]})
    if file and await ensure_socket_member(sid, file.roomId, session["user"]["id"]):
        rel_path = await get_file_path(data["fileId"])
        await db.file.delete(where={"id": data["fileId"]})
        await sio.emit("file-deleted", {"fileId": data["fileId"], "user": session["user"]}, room=file.roomId)
        try:
            await delete_file_from_disk(file.roomId, rel_path)
        except Exception as e:
            logger.error(f"Failed to delete file {rel_path} from disk: {e}")



@sio.on("delete-file")
async def delete_file_alias(sid, data):
    await delete_file(sid, data)


@sio.event
async def rename_file(sid, data):
    session = await sio.get_session(sid)
    existing = await db.file.find_unique(where={"id": data["fileId"]})
    if not existing or not await ensure_socket_member(sid, existing.roomId, session["user"]["id"]):
        return
    rel_path_old = await get_file_path(data["fileId"])
    file = await db.file.update(where={"id": data["fileId"]}, data={"name": data["name"]})
    await sio.emit("file-renamed", {"file": jsonable_encoder(file), "user": session["user"]}, room=file.roomId)
    try:
        await delete_file_from_disk(file.roomId, rel_path_old)
        await sync_file_to_disk(file.roomId, file.id)
    except Exception as e:
        logger.error(f"Failed to sync renamed file {file.id}: {e}")



@sio.on("rename-file")
async def rename_file_alias(sid, data):
    await rename_file(sid, data)


@sio.event
async def file_tree_refresh(sid, data):
    session = await sio.get_session(sid)
    room_id = data["roomId"]
    if not await ensure_socket_member(sid, room_id, session["user"]["id"]):
        return
    await sio.emit("files-refresh", {"roomId": room_id}, room=room_id, skip_sid=sid)


@sio.on("terminal_init")
async def terminal_init(sid, data):
    room_id = data.get("roomId")
    cols = data.get("cols", 80)
    rows = data.get("rows", 24)
    if not room_id:
        return
    session = await sio.get_session(sid)
    if not await ensure_socket_member(sid, room_id, session["user"]["id"]):
        return
    # Ensure workspace directory and files are updated
    try:
        await sync_all_files_to_disk(room_id)
    except Exception as e:
        logger.error(f"Failed to sync workspace to disk for terminal session: {e}")
    # Spawn a shell session
    await terminal_manager.create_session(sid, room_id, cols, rows)


@sio.on("terminal_input")
async def terminal_input(sid, data):
    val = data.get("data", "")
    await terminal_manager.write_to_session(sid, val)


@sio.on("terminal_resize")
async def terminal_resize(sid, data):
    cols = data.get("cols", 80)
    rows = data.get("rows", 24)
    terminal_manager.resize_session(sid, cols, rows)

