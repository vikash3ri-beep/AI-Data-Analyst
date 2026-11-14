@echo off
title AskSQL — AI Data Analyst
cd /d "%~dp0"
echo ========================================================
echo   AskSQL — AI Data Analyst
echo   Starting server on http://localhost:3000 ...
echo ========================================================
npm run dev
pause
