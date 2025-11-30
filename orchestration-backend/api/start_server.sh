#!/bin/bash
# Start FastAPI Backend Server for BrandMonitorAI

echo "Starting BrandMonitorAI Backend Server..."
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
    echo "Server will start but may have configuration issues."
    echo ""
fi

# Start the server
echo "Starting FastAPI server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""
python main.py

