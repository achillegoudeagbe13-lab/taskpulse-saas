@echo off
setlocal
cd /d "%~dp0"
call npx prisma generate > brandbuild.log 2>&1
echo === PRISMA_EXIT=%errorlevel% === >> brandbuild.log
call npm run build >> brandbuild.log 2>&1
echo === BUILD_EXIT=%errorlevel% === >> brandbuild.log