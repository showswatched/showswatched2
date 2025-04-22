@echo off
cd /d %~dp0

REM Set log file with date and time
set LOGFILE=backup-log-%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt

REM Add all changes
git add . > "%LOGFILE%" 2>&1

REM Check if there are changes to commit
git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes to commit. >> "%LOGFILE%"
    exit /b 0
)

REM Commit with timestamp
git commit -m "Automated backup %date% %time%" >> "%LOGFILE%" 2>&1

REM Push to GitHub
git push origin main >> "%LOGFILE%" 2>&1

REM Check for errors
if %errorlevel% neq 0 (
    echo ERROR: Backup failed! See %LOGFILE% for details.
    pause
) else (
    echo Backup successful! See %LOGFILE% for details.
)
