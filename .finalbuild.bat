@echo off
cd /d C:\Users\ADM\Desktop\taskpilse2
call npm run build > .finalbuild.log 2>&1
echo EXIT=%ERRORLEVEL% >> .finalbuild.log
