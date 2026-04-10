"""
JSON 文件存储封装，使用 filelock 保证并发安全。
"""
import json
from pathlib import Path
from filelock import FileLock
from config import DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

_LOCK_SUFFIX = ".lock"


def _lock_path(file_path: Path) -> Path:
    return file_path.with_suffix(_LOCK_SUFFIX)


def read_json(filename: str, default=None):
    """读取 JSON 文件，若不存在返回 default（列表/字典）。"""
    file_path = DATA_DIR / filename
    lock = FileLock(str(_lock_path(file_path)))
    with lock:
        if not file_path.exists():
            return default if default is not None else []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return default if default is not None else []


def write_json(filename: str, data):
    """写入 JSON 文件（覆盖）。"""
    file_path = DATA_DIR / filename
    lock = FileLock(str(_lock_path(file_path)))
    with lock:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


# ── 具体数据文件操作 ──────────────────────────────────────────────────────────

def get_users() -> list:
    return read_json("users.json", [])


def save_users(users: list):
    write_json("users.json", users)


def get_videos() -> list:
    return read_json("videos.json", [])


def save_videos(videos: list):
    write_json("videos.json", videos)


def get_announcement() -> dict:
    return read_json("announcements.json", {"content": "## 欢迎使用 AE1人人创管理平台\n\n请在此处添加公告内容。", "updated_by": "system", "updated_at": ""})


def save_announcement(data: dict):
    write_json("announcements.json", data)


def get_tools() -> list:
    return read_json("tools.json", [])


def save_tools(tools: list):
    write_json("tools.json", tools)


def get_messages() -> list:
    return read_json("messages.json", [])


def save_messages(messages: list):
    write_json("messages.json", messages)
