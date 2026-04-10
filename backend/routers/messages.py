"""
留言反馈路由（所有登录用户可读写）。
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

import storage
from auth import get_current_user, require_admin
from config import MESSAGE_RETENTION_DAYS
from schemas import MessageCreate

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _prune_expired_messages(messages: list[dict]) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=MESSAGE_RETENTION_DAYS)
    kept = []
    for msg in messages:
        try:
            created_at = datetime.fromisoformat(msg.get("created_at", ""))
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if created_at >= cutoff:
            kept.append(msg)
    return kept


@router.get("")
def list_messages(current_user: dict = Depends(get_current_user)):
    messages = _prune_expired_messages(storage.get_messages())
    storage.save_messages(messages)
    return sorted(messages, key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("")
def create_message(req: MessageCreate, current_user: dict = Depends(get_current_user)):
    messages = _prune_expired_messages(storage.get_messages())
    new_msg = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "content": req.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    messages.append(new_msg)
    storage.save_messages(messages)
    return new_msg


@router.delete("/{message_id}")
def delete_message(message_id: str, current_user: dict = Depends(require_admin)):
    messages = _prune_expired_messages(storage.get_messages())
    target = next((m for m in messages if m["id"] == message_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="留言不存在")

    storage.save_messages([m for m in messages if m["id"] != message_id])
    return {"message": "留言已删除"}
