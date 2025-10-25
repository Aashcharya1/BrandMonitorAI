#!/bin/bash
echo "Checking for processes on port 9002..."

# Kill any processes using port 9002
lsof -ti:9002 | xargs kill -9 2>/dev/null || true

echo "Starting Next.js development server..."
npm run dev
