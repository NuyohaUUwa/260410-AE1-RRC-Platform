"""
Pydantic 请求/响应模型。
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=6, max_length=64)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── User ─────────────────────────────────────────────────────────────────────

class UpdatePriorityRequest(BaseModel):
    priority: int = Field(..., ge=1, le=9)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=64)
    new_password: str = Field(..., min_length=6, max_length=64)


# ── Video ─────────────────────────────────────────────────────────────────────

class VideoMeta(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=2000)


# ── Announcement ─────────────────────────────────────────────────────────────

class AnnouncementUpdate(BaseModel):
    content: str


# ── Tool ─────────────────────────────────────────────────────────────────────

class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(default="", max_length=300)
    icon: Optional[str] = Field(default="fa-link", max_length=100)


class ToolUpdate(ToolCreate):
    display_order: Optional[int] = None


# ── Message ──────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
