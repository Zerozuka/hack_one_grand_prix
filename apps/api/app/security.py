from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from app.config import get_settings

ALGORITHM = "HS256"


def create_internal_token(payload: dict[str, Any], expires_in_minutes: int = 30) -> str:
    settings = get_settings()
    body = payload.copy()
    body["exp"] = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
    return jwt.encode(body, settings.api_internal_jwt_secret, algorithm=ALGORITHM)


def decode_internal_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.api_internal_jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid internal token") from exc

