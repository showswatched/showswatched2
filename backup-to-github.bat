@echo off
cd /d %~dp0
git add .
git commit -m "Automated backup %date% %time%"
git push
