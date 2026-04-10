import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).parent.parent

# 数据目录
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads" / "videos"

# JWT 配置
SECRET_KEY = os.getenv("SECRET_KEY", "ae1-rrc-platform-secret-key-2026-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天

# 应用配置
APP_NAME = "AE1人人创管理平台"
APP_VERSION = "1.0.0"

# 服务器配置
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "10123"))

# 默认主admin账号
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_ADMIN_PRIORITY = 10

# 视频锁定时间（分钟）
VIDEO_LOCK_MINUTES = 30

# 视频访问锁定阈值 priority
VIDEO_LOCK_PRIORITY_THRESHOLD = 6

# Admin 权限 priority 阈值
ADMIN_PRIORITY_THRESHOLD = 8

# 留言保留天数
MESSAGE_RETENTION_DAYS = 7

# 最大 priority
MAX_PRIORITY = 10

# 默认用户 priority
DEFAULT_USER_PRIORITY = 3

# 允许上传的视频格式
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".flv", ".wmv", ".webm", ".m4v"}

# 最大上传文件大小（字节），默认 5GB
MAX_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024
