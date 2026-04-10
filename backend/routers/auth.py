"""
注册 / 登录路由。
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

import storage
from auth import hash_password, verify_password, create_access_token
from config import DEFAULT_USER_PRIORITY
from schemas import RegisterRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest):
    users = storage.get_users()

    # 用户名唯一性校验
    if any(u["username"].lower() == req.username.lower() for u in users):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password_hash": hash_password(req.password),
        "priority": DEFAULT_USER_PRIORITY,
        "is_main_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users.append(new_user)
    storage.save_users(users)

    token = create_access_token({"sub": new_user["id"]})
    return TokenResponse(
        access_token=token,
        user=_safe_user(new_user, is_main_admin=False),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    users = storage.get_users()
    user = next((u for u in users if u["username"].lower() == req.username.lower()), None)

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=token,
        user=_safe_user(user, is_main_admin=user.get("is_main_admin", False)),
    )


def _safe_user(user: dict, is_main_admin: bool) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "priority": user["priority"],
        "is_main_admin": user.get("is_main_admin", False),
        "created_at": user.get("created_at", ""),
    }
