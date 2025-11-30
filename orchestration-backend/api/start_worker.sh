#!/bin/bash
# Start Celery Worker for BrandMonitorAI

echo "Starting Celery Worker for BrandMonitorAI..."
echo ""

# Check if virtual environment exists
if [ -f "venv/bin/activate" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
else
    echo "Warning: Virtual environment not found. Using system Python."
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please create one based on DETAILS.md"
    echo "Worker will start but may have configuration issues."
    echo ""
fi

# Start the worker
echo "Starting Celery worker..."
echo "This worker will process scan tasks (amass, masscan, nmap, nessus)"
echo "Press Ctrl+C to stop the worker"
echo ""
celery -A celery_app worker --loglevel=info

