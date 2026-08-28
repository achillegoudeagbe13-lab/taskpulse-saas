@echo off
cd /d C:\Users\ADM\Desktop\taskpilse2
call npx prisma generate > .fb.log 2>&1
echo === PRISMA_DONE EXITCODE=%ERRORLEVEL% === >> .fb.log
call npx next build >> .fb.log 2>&1
echo === BUILD_EXIT=%ERRORLEVEL% === >> .fb.log