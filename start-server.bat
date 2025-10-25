@echo off
echo Checking for processes on port 9002...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9002') do (
    echo Killing process %%a on port 9002...
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting Next.js development server...
npm run dev
