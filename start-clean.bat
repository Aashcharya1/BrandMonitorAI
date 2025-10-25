@echo off
echo ========================================
echo BrandMonitorAI Development Server
echo ========================================

echo.
echo Step 1: Killing any processes on port 9002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9002') do (
    echo   Killing process %%a...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Step 2: Starting Next.js development server...
echo   Server will be available at: http://localhost:9002
echo   Press Ctrl+C to stop the server
echo.

npm run dev
