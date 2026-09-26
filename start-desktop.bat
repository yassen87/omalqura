@echo off
title Zei Perfumes - WhatsApp Desktop
cd /d "%~dp0"
echo Starting WhatsApp Electron dashboard...
echo.
if not exist "node_modules\electron" (
  echo Installing dependencies...
  call npm install
)
call npm run electron
pause
