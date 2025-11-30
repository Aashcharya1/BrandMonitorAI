@echo off
REM Start FastAPI Backend Server for BrandMonitorAI
echo Starting BrandMonitorAI Backend Server...
echo.

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found. Using system Python.
    echo.
)

REM Check if .env exists
if not exist ".env" (
    echo Warning: .env file not found. Please create one based on DETAILS.md
    echo Server will start but may have configuration issues.
    echo.
)

REM Start the server
echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python main.py

pause

