@echo off
cd /d C:\Users\ADM\Desktop\taskpilse2
taskkill /F /IM node.exe >nul 2>&1
if exist .next rmdir /s /q .next >nul 2>&1
if exist .finalbuild.log del .finalbuild.log >nul 2>&1
echo === START %DATE% %TIME% === >> .final.log
call npm run build >> .final.log 2>&1
echo === BUILD_EXIT=%ERRORLEVEL% === >> .final.log
git add -A >> .final.log 2>&1
git commit -m "feat(ui): modal scroll+lock, dashboard quick-blocks, dark/light toggle, tasks CSV export" >> .final.log 2>&1
git push origin main >> .final.log 2>&1
echo === PUSH_ERRORLEVEL=%ERRORLEVEL% === >> .final.log
echo === END %DATE% %TIME% === >> .final.log
