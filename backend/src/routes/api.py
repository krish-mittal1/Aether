from fastapi import APIRouter

from src.controllers import ai, auth, chat, execution, files, rooms

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(rooms.router)
api_router.include_router(files.router)
api_router.include_router(chat.router)
api_router.include_router(execution.router)
api_router.include_router(ai.router)
