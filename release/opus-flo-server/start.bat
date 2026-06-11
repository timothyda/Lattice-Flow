@echo off
cd /d "%~dp0"
echo Starting Opus Flo Server...
echo.
if not exist ".env" (
    echo No .env file found. Copying .env.example to .env...
    copy .env.example .env
    echo.
    echo Please edit .env and set your JWT_SECRET before continuing.
    echo Open .env in Notepad, change JWT_SECRET, save, then run start.bat again.
    pause
    exit /b 1
)
.\node.exe dist/index.js
pause
