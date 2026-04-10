"""
工具链接路由（admin可增删改，所有登录用户可读）。
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

import storage
from auth import get_current_user, require_admin
from schemas import ToolCreate, ToolUpdate

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("")
def list_tools(current_user: dict = Depends(get_current_user)):
    tools = storage.get_tools()
    return sorted(tools, key=lambda x: x.get("display_order", 999))


@router.post("")
def create_tool(req: ToolCreate, current_user: dict = Depends(require_admin)):
    tools = storage.get_tools()
    new_tool = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "url": req.url,
        "description": req.description or "",
        "icon": req.icon or "fa-link",
        "display_order": len(tools),
        "created_by": current_user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    tools.append(new_tool)
    storage.save_tools(tools)
    return new_tool


@router.put("/{tool_id}")
def update_tool(tool_id: str, req: ToolUpdate, current_user: dict = Depends(require_admin)):
    tools = storage.get_tools()
    tool = next((t for t in tools if t["id"] == tool_id), None)
    if not tool:
        raise HTTPException(status_code=404, detail="工具链接不存在")

    tool["name"] = req.name
    tool["url"] = req.url
    tool["description"] = req.description or ""
    tool["icon"] = req.icon or "fa-link"
    if req.display_order is not None:
        tool["display_order"] = req.display_order

    storage.save_tools(tools)
    return tool


@router.delete("/{tool_id}")
def delete_tool(tool_id: str, current_user: dict = Depends(require_admin)):
    tools = storage.get_tools()
    if not any(t["id"] == tool_id for t in tools):
        raise HTTPException(status_code=404, detail="工具链接不存在")

    tools = [t for t in tools if t["id"] != tool_id]
    storage.save_tools(tools)
    return {"message": "已删除"}
