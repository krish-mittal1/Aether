from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from src.db import db
from src.middleware.auth import get_current_user
from src.utils.security import create_access_token, hash_password, verify_password
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupBody(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "createdAt": user.createdAt.isoformat(),
    }


@router.post("/signup")
async def signup(body: SignupBody):
    existing = await db.user.find_first(where={"OR": [{"email": body.email}, {"username": body.username}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already exists")
    user = await db.user.create(
        data={
            "username": body.username,
            "email": body.email,
            "password": hash_password(body.password),
            "avatar": f"https://api.dicebear.com/9.x/initials/svg?seed={body.username}",
        }
    )
    token = create_access_token(user.id, {"username": user.username})
    return {"token": token, "user": serialize_user(user)}


@router.post("/login")
async def login(body: LoginBody):
    user = await db.user.find_unique(where={"email": body.email})
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return {"token": create_access_token(user.id, {"username": user.username}), "user": serialize_user(user)}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return serialize_user(user)
