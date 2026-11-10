@echo off
cd /d "%~dp0"
echo Installing LOUF AI backend dependencies...
call npm install
if errorlevel 1 goto failed
echo Installing LOUF AI frontend dependencies...
call npm --prefix client install
if errorlevel 1 goto failed
echo.
echo Dependencies installed. Copy .env.example to .env and configure it before starting.
pause
exit /b 0
:failed
echo Installation failed. Check your internet connection and Node.js/npm installation.
pause
exit /b 1
