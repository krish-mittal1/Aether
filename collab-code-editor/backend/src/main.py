import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from src.config import settings
from src.db import connect_db, disconnect_db
from src.middleware.errors import RateLimitMiddleware, RequestLogMiddleware, unhandled_exception_handler
from src.routes.api import api_router
from src.services.presence import presence
from src.sockets.events import sio

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await presence.close()
    await disconnect_db()


fastapi_app = FastAPI(title=settings.app_name, lifespan=lifespan)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
fastapi_app.add_middleware(RequestLogMiddleware)
fastapi_app.add_middleware(RateLimitMiddleware, max_requests=500, window_seconds=60)
fastapi_app.add_exception_handler(Exception, unhandled_exception_handler)
fastapi_app.include_router(api_router)


@fastapi_app.get("/health")
async def health():
    return {"status": "ok"}


app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="/socket.io")
