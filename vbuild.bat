@echo off
cd /d C:\Users\ADM\Desktop\taskpilse2
echo === BUILD START %date% %time% === > .vbuild.log
call npm run build >> .vbuild.log 2>&1
echo BUILD_EXIT=%errorlevel% >> .vbuild.log
echo === BUILD END %date% %time% === >> .vbuild.log