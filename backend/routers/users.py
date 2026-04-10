"""
用户管理路由（priority 查看/修改仅主admin）。
"""
from fastapi import APIRouter, Depends, HTTPException, status

import storage
from auth import get_current_user, require_admin, require_main_admin, hash_password, verify_password
from config import ADMIN_PRIORITY_THRESHOLD
from schemas import ChangePasswordRequest, UpdatePriorityRequest

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(current_user: dict = Depends(require_admin)):
    """
    获取用户列表。
    - priority >= 8 的用户可访问。
    - 管理员及以上可查看。
    """
    users = storage.get_users()

    result = []
    for u in users:
        item = {
            "id": u["id"],
            "username": u["username"],
            "is_main_admin": u.get("is_main_admin", False),
            "created_at": u.get("created_at", ""),
            "priority": u["priority"],
        }
        result.append(item)
    return result


@router.put("/{user_id}/priority")
def update_priority(
    user_id: str,
    req: UpdatePriorityRequest,
    current_user: dict = Depends(require_main_admin),
):
    """修改用户 priority，仅主 admin 可操作，不可修改主 admin 自身。"""
    users = storage.get_users()
    target = next((u for u in users if u["id"] == user_id), None)

    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    if target.get("is_main_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不可修改主管理员的 priority")

    # priority 范围 1-9（主admin专属10）
    if req.priority < 1 or req.priority > 9:
        raise HTTPException(status_code=400, detail="priority 范围为 1-9")

    target["priority"] = req.priority
    storage.save_users(users)
    return {"message": "priority 已更新", "user_id": user_id, "priority": req.priority}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "priority": current_user["priority"],
        "is_main_admin": current_user.get("is_main_admin", False),
        "created_at": current_user.get("created_at", ""),
    }


@router.put("/me/password")
def change_my_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """当前登录用户修改自己的密码。"""
    if not verify_password(req.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码错误")

    if req.current_password == req.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码不能与当前密码相同")

    users = storage.get_users()
    target = next((u for u in users if u["id"] == current_user["id"]), None)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    target["password_hash"] = hash_password(req.new_password)
    storage.save_users(users)
    return {"message": "密码已更新"}
