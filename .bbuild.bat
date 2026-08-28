@echo off
cd /d C:\Users\ADM\Desktop\taskpilse2
call npx prisma generate > .bbuild.log 2>&1
echo === PRISMA_EXIT=%errorlevel% === >> .bbuild.log
call npm run build >> .bbuild.log 2>&1
echo === BUILD_EXIT=%errorlevel% === >> .bbuild.log