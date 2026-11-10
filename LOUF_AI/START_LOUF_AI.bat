@echo off
setlocal
cd /d "%~dp0"
title LOUF AI Launcher

if not exist ".env" (
  echo ERROR: .env file not found in:
  echo %CD%
  echo Copy .env.example to .env and configure it first.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Backend dependencies are missing. Installing them now...
  call npm install
  if errorlevel 1 goto failed
)

if not exist "client\node_modules\vite" (
  echo Frontend dependencies are missing. Installing them now...
  call npm --prefix client install
  if errorlevel 1 goto failed
)

echo.
echo Starting LOUF AI backend at http://localhost:3000 ...
start "LOUF AI Backend" cmd /k "cd /d ""%CD%"" && npm run server"
timeout /t 2 /nobreak >nul

echo Starting LOUF AI frontend at http://localhost:5173 ...
start "LOUF AI Frontend" cmd /k "cd /d ""%CD%"" && npm --prefix client run dev"
echo.
echo Leave both terminal windows open.
echo Open exactly: http://localhost:5173/
echo API health check: http://localhost:3000/api/health
echo If Vite reports port 5173 is already in use, close the old Vite/Node process and run this file again.
pause
exit /b 0

:failed
echo.
echo Dependency installation failed. Check Node.js, npm and internet connection.
pause
exit /b 1
