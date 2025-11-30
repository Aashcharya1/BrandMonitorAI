@echo off
REM Start Celery Worker for BrandMonitorAI
echo Starting Celery Worker for BrandMonitorAI...
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
    echo Worker will start but may have configuration issues.
    echo.
)

REM Start the worker
echo Starting Celery worker...
echo This worker will process scan tasks (amass, masscan, nmap, nessus)
echo Press Ctrl+C to stop the worker
echo.
celery -A celery_app worker --loglevel=info --pool=solo

pause

