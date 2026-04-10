"""
公告路由（admin可编辑，所有登录用户可读）。
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

import storage
from auth import get_current_user, require_admin
from schemas import AnnouncementUpdate

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("")
def get_announcement(current_user: dict = Depends(get_current_user)):
    return storage.get_announcement()


@router.put("")
def update_announcement(req: AnnouncementUpdate, current_user: dict = Depends(require_admin)):
    data = {
        "content": req.content,
        "updated_by": current_user["username"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    storage.save_announcement(data)
    return data
