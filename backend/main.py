"""
AE1人人创管理平台 - FastAPI 主入口
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import (
    APP_NAME,
    APP_VERSION,
    BASE_DIR,
    DATA_DIR,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PRIORITY,
    UPLOADS_DIR,
)
from auth import hash_password
import storage

# ── 路由 ──────────────────────────────────────────────────────────────────────
from routers import auth, users, videos, announcements, tools, messages

app = FastAPI(title=APP_NAME, version=APP_VERSION)

# CORS（局域网访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(videos.router)
app.include_router(announcements.router)
app.include_router(tools.router)
app.include_router(messages.router)

# 静态文件服务
FRONTEND_DIR = BASE_DIR / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/login")
def serve_login():
    return FileResponse(str(FRONTEND_DIR / "login.html"))


# 捕获前端路由（SPA fallback）
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    # 先尝试静态文件
    candidate = FRONTEND_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(str(candidate))
    # 默认返回 index.html
    return FileResponse(str(FRONTEND_DIR / "index.html"))


# ── 启动初始化 ────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup_init():
    """启动时初始化目录及默认 admin 账号。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    users_list = storage.get_users()

    # 检查是否已存在主 admin
    main_admin = next((u for u in users_list if u.get("is_main_admin")), None)
    if not main_admin:
        default_admin = {
            "id": str(uuid.uuid4()),
            "username": DEFAULT_ADMIN_USERNAME,
            "password_hash": hash_password(DEFAULT_ADMIN_PASSWORD),
            "priority": DEFAULT_ADMIN_PRIORITY,
            "is_main_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        users_list.insert(0, default_admin)
        storage.save_users(users_list)
        print(f"[INIT] 默认主admin账号已创建: {DEFAULT_ADMIN_USERNAME} / {DEFAULT_ADMIN_PASSWORD}")
    else:
        print(f"[INIT] 主admin账号已存在: {main_admin['username']}")
