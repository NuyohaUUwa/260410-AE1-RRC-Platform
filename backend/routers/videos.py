"""
视频上传 / 下载 / 预览路由（含30分钟锁定逻辑）。
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

import storage
from auth import get_current_user, get_current_user_flexible
from config import (
    ALLOWED_VIDEO_EXTENSIONS,
    UPLOADS_DIR,
    VIDEO_LOCK_MINUTES,
    VIDEO_LOCK_PRIORITY_THRESHOLD,
)

router = APIRouter(prefix="/api/videos", tags=["videos"])

CHUNK_SIZE = 1024 * 1024  # 1MB


def _is_locked(upload_time_str: str) -> bool:
    """判断视频是否还在30分钟锁定期内。"""
    try:
        upload_time = datetime.fromisoformat(upload_time_str)
        if upload_time.tzinfo is None:
            upload_time = upload_time.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - upload_time < timedelta(minutes=VIDEO_LOCK_MINUTES)
    except Exception:
        return False


def _can_access(video: dict, user: dict) -> bool:
    """根据锁定逻辑判断用户是否有权访问该视频。"""
    if video.get("uploader_id") == user.get("id"):
        return True
    if _is_locked(video["upload_time"]):
        return user["priority"] >= VIDEO_LOCK_PRIORITY_THRESHOLD
    return True


def _video_response(video: dict, user: dict) -> dict:
    """构造返回给前端的视频信息，附带锁定状态。"""
    locked = _is_locked(video["upload_time"])
    published_user_ids = video.get("published_user_ids", [])
    users = storage.get_users()
    user_map = {u["id"]: u.get("username", "") for u in users}
    published_usernames = [user_map[user_id] for user_id in published_user_ids if user_map.get(user_id)]
    return {
        "id": video["id"],
        "title": video["title"],
        "description": video.get("description", ""),
        "original_filename": video["original_filename"],
        "file_size": video["file_size"],
        "uploader_id": video["uploader_id"],
        "uploader_name": video["uploader_name"],
        "upload_time": video["upload_time"],
        "download_count": video["download_count"],
        "published_count": len(published_user_ids),
        "published_by_me": user.get("id") in published_user_ids,
        "published_usernames": published_usernames,
        "locked": locked,
        "can_access": _can_access(video, user),
    }


@router.get("")
def list_videos(current_user: dict = Depends(get_current_user)):
    """获取视频列表，低优先级用户在锁定期内看不到受限视频。"""
    videos = storage.get_videos()
    result = []
    for v in videos:
        if _can_access(v, current_user):
            result.append(_video_response(v, current_user))
    # 按上传时间倒序
    result.sort(key=lambda x: x["upload_time"], reverse=True)
    return result


@router.post("/upload")
async def upload_video(
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """上传视频文件。"""
    # 扩展名校验
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的视频格式，允许: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}",
        )

    # 读取文件内容并计算 MD5
    content = await file.read()
    file_hash = hashlib.md5(content).hexdigest()

    # 唯一性校验
    videos = storage.get_videos()
    if any(v["file_hash"] == file_hash for v in videos):
        raise HTTPException(status_code=400, detail="该视频已存在，请勿重复上传")

    # 保存文件
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    saved_filename = f"{uuid.uuid4()}{suffix}"
    save_path = UPLOADS_DIR / saved_filename

    async with aiofiles.open(save_path, "wb") as f:
        await f.write(content)

    # 写入元数据
    new_video = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "filename": saved_filename,
        "original_filename": file.filename,
        "file_hash": file_hash,
        "file_size": len(content),
        "uploader_id": current_user["id"],
        "uploader_name": current_user["username"],
        "upload_time": datetime.now(timezone.utc).isoformat(),
        "download_count": 0,
        "published_user_ids": [],
    }
    videos.append(new_video)
    storage.save_videos(videos)

    return {"message": "上传成功", "video": _video_response(new_video, current_user)}


@router.get("/{video_id}/stream")
async def stream_video(video_id: str, request: Request, current_user: dict = Depends(get_current_user_flexible)):
    """视频流预览，支持 Range 请求（断点续传/拖拽进度条）。"""
    videos = storage.get_videos()
    video = next((v for v in videos if v["id"] == video_id), None)

    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    if not _can_access(video, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"视频上传后 {VIDEO_LOCK_MINUTES} 分钟内仅限高优先级用户访问",
        )

    file_path = UPLOADS_DIR / video["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="视频文件不存在")

    file_size = file_path.stat().st_size
    suffix = Path(video["filename"]).suffix.lower()
    media_type_map = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".ogg": "video/ogg",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".flv": "video/x-flv",
        ".wmv": "video/x-ms-wmv",
        ".m4v": "video/mp4",
    }
    media_type = media_type_map.get(suffix, "application/octet-stream")

    range_header = request.headers.get("range")
    if range_header:
        # 解析 Range: bytes=start-end
        range_val = range_header.strip().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        async def iter_file():
            async with aiofiles.open(file_path, "rb") as f:
                await f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = await f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": media_type,
        }
        return StreamingResponse(iter_file(), status_code=206, headers=headers)

    # 全量返回
    async def iter_full():
        async with aiofiles.open(file_path, "rb") as f:
            while True:
                chunk = await f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": media_type,
    }
    return StreamingResponse(iter_full(), headers=headers)


@router.get("/{video_id}/download")
def download_video(video_id: str, current_user: dict = Depends(get_current_user_flexible)):
    """下载视频，并增加下载计数。"""
    videos = storage.get_videos()
    video = next((v for v in videos if v["id"] == video_id), None)

    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    if not _can_access(video, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"视频上传后 {VIDEO_LOCK_MINUTES} 分钟内仅限高优先级用户下载",
        )

    file_path = UPLOADS_DIR / video["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="视频文件不存在")

    # 增加下载计数
    video["download_count"] = video.get("download_count", 0) + 1
    storage.save_videos(videos)

    return FileResponse(
        path=str(file_path),
        filename=video["original_filename"],
        media_type="application/octet-stream",
    )


@router.post("/{video_id}/published-toggle")
def toggle_published(video_id: str, current_user: dict = Depends(get_current_user)):
    """切换当前用户对该视频的“已发布”快捷回复状态。"""
    videos = storage.get_videos()
    video = next((v for v in videos if v["id"] == video_id), None)

    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    if not _can_access(video, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前无权操作该视频",
        )

    published_user_ids = video.setdefault("published_user_ids", [])
    user_id = current_user["id"]

    if user_id in published_user_ids:
        published_user_ids.remove(user_id)
        active = False
    else:
        published_user_ids.append(user_id)
        active = True

    storage.save_videos(videos)
    users = storage.get_users()
    user_map = {u["id"]: u.get("username", "") for u in users}
    return {
        "video_id": video_id,
        "published_count": len(published_user_ids),
        "published_by_me": active,
        "published_usernames": [user_map[item] for item in published_user_ids if user_map.get(item)],
    }


@router.delete("/{video_id}")
def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    """删除视频（仅上传者或admin可删除）。"""
    from config import ADMIN_PRIORITY_THRESHOLD

    videos = storage.get_videos()
    video = next((v for v in videos if v["id"] == video_id), None)

    if not video:
        raise HTTPException(status_code=404, detail="视频不存在")

    is_admin = current_user["priority"] >= ADMIN_PRIORITY_THRESHOLD
    is_owner = video["uploader_id"] == current_user["id"]

    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="无权删除该视频")

    # 删除文件
    file_path = UPLOADS_DIR / video["filename"]
    if file_path.exists():
        file_path.unlink()

    videos = [v for v in videos if v["id"] != video_id]
    storage.save_videos(videos)
    return {"message": "视频已删除"}
