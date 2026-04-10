@echo off
chcp 65001 >nul
title AE1人人创管理平台

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     AE1人人创管理平台  启动中...     ║
echo  ╚══════════════════════════════════════╝
echo.

:: 进入 backend 目录
cd /d "%~dp0backend"

:: 激活 conda 环境并启动
call conda activate redoubao 2>nul

:: 检查依赖
echo [1/2] 检查并安装依赖...
python -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查 requirements.txt 或 conda 环境
    pause
    exit /b 1
)

:: 从 config.py 读取端口号
for /f %%p in ('python -c "from config import SERVER_HOST, SERVER_PORT; print(SERVER_PORT)"') do set PORT=%%p
for /f %%h in ('python -c "from config import SERVER_HOST, SERVER_PORT; print(SERVER_HOST)"') do set HOST=%%h

:: 获取本机局域网 IP
echo.
echo [2/2] 启动服务器...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LAN_IP=%%a
    goto :found_ip
)
:found_ip
set LAN_IP=%LAN_IP: =%

echo  ┌─────────────────────────────────────────┐
echo  │  本机访问：http://localhost:%PORT%          │
echo  │  局域网  ：http://%LAN_IP%:%PORT%
echo  │                                         │
echo  │  默认账号：admin / admin123              │
echo  │  按 Ctrl+C 停止服务                      │
echo  └─────────────────────────────────────────┘
echo.

python -m uvicorn main:app --host %HOST% --port %PORT%

echo.
echo 服务已停止。
pause
