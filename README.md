# AE1人人创管理平台

基于 Python FastAPI 的视频上传/下载管理 Web 应用，支持局域网访问、Priority 权限体系、视频管理、公告编辑、工具链接和留言反馈。

---

## 功能概览

- 用户注册与登录（JWT 认证）
- Priority 权限体系（1-10，主admin唯一）
- 视频上传（MD5 去重）/ 下载 / 网页内预览
- 视频30分钟锁定测试功能（priority < 4 的用户需等待解锁）
- 公告区（Markdown，admin可编辑）
- 工具链接区（admin可管理）
- 留言反馈区（所有用户可用）
- 全量数据 JSON 文件存储（无需数据库）

---

## 环境要求

- Python 3.9+
- conda 环境 `redoubao`（或其他 Python 环境）

---

## Priority 权限说明

| Priority | 角色 | 说明 |
|----------|------|------|
| 10 | 主管理员 | 系统唯一，拥有所有权限，可修改其他用户 priority |
| 8–9 | 管理员 | 可编辑公告、工具链接，查看用户列表 |
| 6–7 | 高级用户 | 视频上传后30分钟内可提前访问 |
| 1–5 | 普通用户 | 注册默认 priority=3，视频30分钟后可访问 |

---

## 视频30分钟测试锁定

- 视频上传后30分钟内，**priority < 6** 的用户无法看到和下载该视频
- **priority >= 6** 的用户可立即访问
- 30分钟后所有用户均可访问

---

## 项目结构

```
260410-AE1-RRC-Platform/
├── backend/             # FastAPI 后端
│   ├── main.py
│   ├── config.py
│   ├── storage.py       # JSON 文件存储封装
│   ├── auth.py          # JWT 认证
│   ├── schemas.py       # Pydantic 模型
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py
│       ├── users.py
│       ├── videos.py
│       ├── announcements.py
│       ├── tools.py
│       └── messages.py
├── frontend/            # 前端静态文件
│   ├── index.html       # 主页面
│   ├── login.html       # 登录/注册
│   ├── css/style.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── app.js
│       ├── videos.js
│       ├── admin.js
│       └── messages.js
├── data/                # JSON 数据文件（自动生成）
└── uploads/videos/      # 上传的视频文件（自动生成）
```

---

## 数据备份

所有数据存储在 `data/` 目录下的 JSON 文件中，直接复制该目录即可完成备份。
视频文件存储在 `uploads/videos/` 目录下。
