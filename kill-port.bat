@echo off
echo Killing processes on port 9002...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9002') do (
    echo Killing process %%a...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo Process %%a not found or already terminated
    ) else (
        echo Successfully killed process %%a
    )
)

echo Port 9002 should now be free.
pause
