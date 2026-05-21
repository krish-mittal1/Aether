from datetime import datetime, timedelta, timezone
import hashlib
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _bcrypt_safe_secret(password: str) -> str:
    # bcrypt rejects secrets above 72 bytes in recent versions. Hash first so
    # arbitrary-length user passwords remain supported without silent truncation.
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(_bcrypt_safe_secret(password))


def verify_password(password: str, password_hash: str) -> bool:
    safe_secret = _bcrypt_safe_secret(password)
    if pwd_context.verify(safe_secret, password_hash):
        return True
    # Backward compatibility for accounts created before password pre-hashing.
    try:
        return pwd_context.verify(password, password_hash)
    except ValueError:
        return False


def create_access_token(subject: str, extra: Optional[Dict[str, Any]] = None) -> str:
    payload: Dict[str, Any] = {
        "sub": subject,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("invalid token") from exc
