# BrandMonitorAI - Setup Guide

Complete setup instructions for running the BrandMonitorAI application.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Variables](#environment-variables)
5. [Running the Application](#running-the-application)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Python 3.10+** (3.12 recommended)
- **Node.js 18+** (20+ recommended)
- **npm** or **yarn**
- **Redis** (for Celery task queue)
- **MongoDB** (for user data and chat history)

### Optional Software (for full functionality)

- **PostgreSQL** (optional, for advanced analytics)
- **Elasticsearch 7.13.4** (optional, for search indexing)
- **Meilisearch** (optional, for fast search)
- **Nessus** (optional, for vulnerability scanning)
- **SpiderFoot** (optional, for external surface monitoring)

### System Tools (for scanning)

- **amass** (for passive reconnaissance)
- **masscan** (for fast port scanning)
- **nmap** (for service detection)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd BrandMonitorAI
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd orchestration-backend/api

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# From project root
npm install
```

### 4. Start Services

**Terminal 1 - Redis:**

**First, check if Redis is already running:**
```bash
# Windows
netstat -ano | findstr :6379

# Linux/Mac
lsof -i :6379
```

**If Redis is NOT running, start it:**

**Windows (Docker - Recommended):**
```bash
# Make sure Docker Desktop is running first!
docker run -d -p 6379:6379 --name redis redis:latest

# Or if you have a docker-compose setup:
cd orchestration-backend/api
docker-compose up -d redis
```

**Windows (Native - if installed):**
```bash
redis-server
# Or if using WSL:
wsl redis-server
```

**Linux/Mac:**
```bash
redis-server
# Or if installed as service:
sudo systemctl start redis  # Linux
brew services start redis    # Mac
```

**Verify Redis is working:**
```bash
redis-cli ping
# Should return: PONG
```

**Terminal 2 - MongoDB:**

**First, check if MongoDB is already running:**
```bash
# Windows
netstat -ano | findstr :27017

# Linux/Mac
lsof -i :27017
```

**If MongoDB is NOT running, start it:**

**Windows (Docker - Recommended):**
```bash
# Make sure Docker Desktop is running first!
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps | findstr mongo
```

**Windows (Native - with custom data directory):**
```bash
# Create data directory first
mkdir C:\data\db

# Start MongoDB
mongod --dbpath C:\data\db

# Or use a path in your project
mkdir F:\Zeroshield\BrandMonitorAI\mongodb-data
mongod --dbpath F:\Zeroshield\BrandMonitorAI\mongodb-data
```

**Linux/Mac:**
```bash
mongod
# Or if installed as service:
sudo systemctl start mongodb  # Linux
brew services start mongodb-community  # Mac
```

**Verify MongoDB is working:**
```bash
mongosh
# Or
mongo
# Should connect and show MongoDB shell
```

**Terminal 3 - Backend API:**
```bash
cd orchestration-backend/api
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

python main.py
# Or use uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 4 - Celery Worker:**
```bash
cd orchestration-backend/api
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

celery -A celery_app worker --loglevel=info --pool=solo
# For Windows, use --pool=solo
# For Linux/Mac, you can use --pool=prefork
```

**Terminal 5 - Frontend:**
```bash
# From project root
npm run dev
```

---

## Detailed Setup

### Step 1: Install Prerequisites

#### Python Setup

1. Download Python 3.10+ from [python.org](https://www.python.org/downloads/)
2. Verify installation:
   ```bash
   python --version
   pip --version
   ```

#### Node.js Setup

1. Download Node.js 18+ from [nodejs.org](https://nodejs.org/)
2. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Redis Setup

**Windows:**
- Download from [redis.io](https://redis.io/download) or use WSL
- Or use Docker: `docker run -d -p 6379:6379 redis:latest`

**Linux:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Mac:**
```bash
brew install redis
brew services start redis
```

#### MongoDB Setup

**Windows:**
- Download from [mongodb.com](https://www.mongodb.com/try/download/community)
- Install and start MongoDB service

**Linux:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**Mac:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Or use Docker:**
```bash
docker run -d -p 27017:27017 mongo:latest
```

### Step 2: Backend Configuration

#### Create Virtual Environment

```bash
cd orchestration-backend/api
python -m venv venv
```

#### Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

#### Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Frontend Configuration

```bash
# From project root
npm install
```

### Step 4: Environment Variables

Create a `.env` file in `orchestration-backend/api/`:

```env
# Server Configuration
PORT=8000
HOST=0.0.0.0
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/brandmonitorai
MONGODB_DB=brandmonitorai

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION=86400

# LibreChat Configuration
LIBRECHAT_URL=http://localhost:3080
LIBRECHAT_API_KEY=your-librechat-api-key

# AI Provider Configuration (Optional)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Elasticsearch Configuration (Optional)
ES_URL=http://localhost:9200
ES_API_KEY=your-elasticsearch-api-key
ES_ASSET_INDEX=assets

# Meilisearch Configuration (Optional)
MEILI_URL=http://localhost:7700
MEILI_KEY=your-meilisearch-master-key
MEILI_INDEX=assets_search

# Nessus Configuration (Optional)
NESSUS_URL=https://localhost:8834
NESSUS_ACCESS_KEY=your-nessus-access-key
NESSUS_SECRET_KEY=your-nessus-secret-key

# SpiderFoot Configuration (Optional)
SPIDERFOOT_API_URL=http://localhost:5001
SPIDERFOOT_API_KEY=your-spiderfoot-api-key

# Email Configuration (Optional, for DMARC reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
```

Create a `.env.local` file in the project root for Next.js:

```env
# Next.js Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MONITOR_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=your-nextauth-secret-key-change-this

# MongoDB for Next.js (if using separate connection)
MONGODB_URI=mongodb://localhost:27017/brandmonitorai
```

---

## Running the Application

### Option 1: Manual Start (Recommended for Development)

#### Start Redis

**Check if Redis is already running:**
```bash
# Windows
netstat -ano | findstr :6379

# Linux/Mac
netstat -tuln | grep 6379
# Or
lsof -i :6379
```

**If Redis is NOT running:**

**Windows:**
```bash
# Option 1: Using Docker (if Docker Desktop is running)
docker run -d -p 6379:6379 --name redis redis:latest

# Option 2: Install Redis for Windows
# Download from: https://github.com/microsoftarchive/redis/releases
# Or use WSL (Windows Subsystem for Linux)
wsl redis-server

# Option 3: Use Memurai (Redis-compatible for Windows)
# Download from: https://www.memurai.com/
```

**Linux:**
```bash
sudo systemctl start redis
# Or if not installed as service:
redis-server
```

**Mac:**
```bash
brew services start redis
# Or:
redis-server
```

**Verify Redis is working:**
```bash
# Test connection
redis-cli ping
# Should return: PONG

# If redis-cli is not in PATH, use Docker:
docker exec -it <redis-container-name> redis-cli ping
```

#### Start MongoDB

**Windows - Option 1 (Recommended - Docker):**
```bash
# Make sure Docker Desktop is running first!
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps | findstr mongo
```

**Windows - Option 2 (Native with custom data directory):**
```bash
# Create data directory (choose a location)
mkdir C:\data\db

# Start MongoDB with custom path
mongod --dbpath C:\data\db

# Or use a path in your project directory
mkdir F:\Zeroshield\BrandMonitorAI\mongodb-data
mongod --dbpath F:\Zeroshield\BrandMonitorAI\mongodb-data
```

**Windows - Option 3 (Using MongoDB as Windows Service):**
```bash
# Install MongoDB as a Windows service (if installed via MSI)
# The service should start automatically
# Check if service is running:
sc query MongoDB

# Or start it manually:
net start MongoDB
```

**Linux/Mac:**
```bash
mongod
# Or if installed as service:
sudo systemctl start mongodb  # Linux
brew services start mongodb-community  # Mac
```

**Verify MongoDB is working:**
```bash
# Test connection
mongosh
# Or if mongosh is not available:
mongo

# Should connect and show MongoDB shell
# Type 'exit' to quit

# Or test from Python:
python -c "from pymongo import MongoClient; c = MongoClient('mongodb://localhost:27017'); print(c.admin.command('ping'))"
```

#### Start Backend API

```bash
cd orchestration-backend/api
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

python main.py
```

The API will be available at: `http://localhost:8000`
API Documentation: `http://localhost:8000/docs`

#### Start Celery Worker

**Windows:**
```bash
cd orchestration-backend/api
venv\Scripts\activate
celery -A celery_app worker --loglevel=info --pool=solo
```

**Linux/Mac:**
```bash
cd orchestration-backend/api
source venv/bin/activate
celery -A celery_app worker --loglevel=info --pool=prefork
```

#### Start Frontend

```bash
# From project root
npm run dev
```

The frontend will be available at: `http://localhost:9002`

### Option 2: Using Provided Scripts

#### Windows

**Start Backend:**
```bash
cd orchestration-backend/api
start_server.bat
```

**Start Celery Worker:**
```bash
cd orchestration-backend/api
start_worker.bat
```

**Start Frontend:**
```bash
# From project root
start-server.bat
```

#### Linux/Mac

**Start Backend:**
```bash
cd orchestration-backend/api
chmod +x start_server.sh
./start_server.sh
```

**Start Celery Worker:**
```bash
cd orchestration-backend/api
chmod +x start_worker.sh
./start_worker.sh
```

**Start Frontend:**
```bash
# From project root
chmod +x start-server.sh
./start-server.sh
```

### Option 3: Docker Compose (Coming Soon)

```bash
cd orchestration-backend/api
docker-compose up -d
```

---

## Verification

### 1. Check Backend API

Open your browser and navigate to:
- API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

You should see the FastAPI documentation page.

### 2. Check Frontend

Open your browser and navigate to:
- Frontend: `http://localhost:9002`

You should see the BrandMonitorAI dashboard.

### 3. Check Celery Worker

Look for these messages in the Celery worker terminal:
```
[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@hostname ready.
```

### 4. Test API Endpoints

**Windows (using PowerShell or Git Bash):**
```powershell
# Health check
curl http://localhost:8000/health
# Or use Invoke-WebRequest:
Invoke-WebRequest -Uri http://localhost:8000/health

# Test scan endpoint (requires authentication)
curl -X POST http://localhost:8000/api/v1/monitor/start `
  -H "Content-Type: application/json" `
  -d '{\"target\": \"example.com\", \"enable_passive\": true, \"enable_active\": true}'
```

**Linux/Mac:**
```bash
# Health check
curl http://localhost:8000/health

# Test scan endpoint (requires authentication)
curl -X POST http://localhost:8000/api/v1/monitor/start \
  -H "Content-Type: application/json" \
  -d '{"target": "example.com", "enable_passive": true, "enable_active": true}'
```

### 4. Verify Redis Connection

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# If redis-cli is not available, use Docker:
docker exec -it redis redis-cli ping

# Or test from Python (in your venv):
python -c "import redis; r = redis.Redis(); print(r.ping())"

# Windows - If using Docker container named differently:
docker exec api-redis-1 redis-cli ping
# Or find your Redis container name:
docker ps | findstr redis
```

---

## Troubleshooting

### Backend Issues

#### Port Already in Use

**Error:** `Address already in use`

**Solution:**
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
```

#### Celery Worker Not Starting

**Error:** `Connection refused` or `No module named 'celery_app'`

**Solution:**
1. Ensure Redis is running: `redis-cli ping` (should return `PONG`)
2. Ensure you're in the correct directory: `cd orchestration-backend/api`
3. Ensure virtual environment is activated
4. For Windows, use `--pool=solo` flag

#### MongoDB Connection Failed

**Error:** `MongoDB connection failed`

**Solution:**
1. Check if MongoDB is running: `mongosh` or `mongo`
2. Verify `MONGODB_URI` in `.env` file
3. Check MongoDB logs for errors

#### Import Errors

**Error:** `ModuleNotFoundError` or `ImportError`

**Solution:**
1. Ensure virtual environment is activated
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Check Python path: `python -c "import sys; print(sys.path)"`

### Frontend Issues

#### Port Already in Use

**Error:** `Port 9002 is already in use`

**Solution:**
```bash
# Windows
netstat -ano | findstr :9002
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:9002 | xargs kill -9
```

#### Module Not Found

**Error:** `Cannot find module`

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Build Errors

**Error:** TypeScript or build errors

**Solution:**
```bash
npm run typecheck  # Check for TypeScript errors
npm run lint       # Check for linting errors
```

### Redis Issues

#### Redis Not Running

**Error:** `Connection refused to redis://localhost:6379`

**Solution:**

1. **Check if Redis is already running:**
   ```bash
   # Windows
   netstat -ano | findstr :6379
   
   # Linux/Mac
   lsof -i :6379
   ```

2. **If Redis is running but connection fails:**
   - Check firewall settings
   - Verify Redis is listening on `127.0.0.1:6379` or `0.0.0.0:6379`
   - Check Redis configuration file

3. **If Redis is NOT running, start it:**
   ```bash
   # Windows (Docker)
   docker run -d -p 6379:6379 --name redis redis:latest
   
   # Windows (Native/WSL)
   redis-server
   # or
   wsl redis-server
   
   # Linux/Mac
   redis-server
   # or
   sudo systemctl start redis
   ```

4. **Verify connection:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

5. **If port 6379 is already in use:**
   ```bash
   # Windows - Find what's using the port
   netstat -ano | findstr :6379
   # Note the PID, then check if it's Redis
   tasklist | findstr <PID>
   
   # If it's a Docker container, you can use it:
   docker ps | findstr redis
   
   # If you need to stop and restart:
   docker stop <container-name>
   docker rm <container-name>
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

### MongoDB Issues

#### MongoDB Data Directory Not Found (Windows)

**Error:** `NonExistentPath: Data directory \\data\\db not found`

**Solution:**

**Option 1 - Use Docker (Easiest):**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option 2 - Create Data Directory:**
```bash
# Create the directory
mkdir C:\data\db

# Start MongoDB with the path
mongod --dbpath C:\data\db
```

**Option 3 - Use Custom Path:**
```bash
# Create directory in your project
mkdir F:\Zeroshield\BrandMonitorAI\mongodb-data

# Start MongoDB
mongod --dbpath F:\Zeroshield\BrandMonitorAI\mongodb-data
```

**Option 4 - Create MongoDB Config File:**
1. Create `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg`:
   ```yaml
   storage:
     dbPath: C:\data\db
   ```
2. Create the directory: `mkdir C:\data\db`
3. Start MongoDB: `mongod --config "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"`

#### MongoDB Not Running

**Error:** `Connection refused to mongodb://localhost:27017`

**Solution:**

1. **Check if MongoDB is already running:**
   ```bash
   # Windows
   netstat -ano | findstr :27017
   
   # Linux/Mac
   lsof -i :27017
   ```

2. **If MongoDB is running but connection fails:**
   - Check firewall settings
   - Verify MongoDB is listening on `127.0.0.1:27017` or `0.0.0.0:27017`
   - Check MongoDB configuration file

3. **If MongoDB is NOT running, start it:**
   ```bash
   # Windows (Docker - Recommended)
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Windows (Native - with custom path)
   mongod --dbpath C:\data\db
   
   # Linux/Mac
   mongod
   # or
   sudo systemctl start mongodb
   ```

4. **Verify connection:**
   ```bash
   # Try to connect
   mongosh
   # Or
   mongo
   
   # Should show MongoDB shell prompt
   # Type 'exit' to quit
   ```

5. **If port 27017 is already in use:**
   ```bash
   # Windows - Find what's using the port
   netstat -ano | findstr :27017
   # Note the PID, then check if it's MongoDB
   tasklist | findstr <PID>
   
   # If it's a Docker container, you can use it:
   docker ps | findstr mongo
   
   # If you need to stop and restart:
   docker stop mongodb
   docker rm mongodb
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

### Common Solutions

#### Clear All Caches

```bash
# Python cache
find . -type d -name __pycache__ -exec rm -r {} +
find . -type f -name "*.pyc" -delete

# Node cache
rm -rf node_modules .next
npm install

# Redis cache
redis-cli FLUSHALL
```

#### Reset Environment

```bash
# Backend
cd orchestration-backend/api
deactivate  # if venv is active
rm -rf venv
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Next Steps

1. **Configure Authentication**: Set up user registration and login
2. **Configure AI Providers**: Add API keys for OpenAI, Anthropic, or AWS Bedrock
3. **Set Up Scanning Tools**: Install and configure amass, masscan, nmap
4. **Configure Optional Services**: Set up Elasticsearch, Meilisearch, Nessus
5. **Review Security**: Change all default secrets and API keys
6. **Set Up Monitoring**: Configure logging and monitoring for production

---

## Production Deployment

For production deployment, consider:

1. **Use Environment-Specific Configs**: Separate `.env` files for dev/staging/prod
2. **Use Process Managers**: PM2 for Node.js, systemd for Python services
3. **Set Up Reverse Proxy**: Nginx or Apache for SSL termination
4. **Enable HTTPS**: Use Let's Encrypt or your SSL certificate
5. **Database Backups**: Regular backups of MongoDB
6. **Monitoring**: Set up application monitoring (e.g., Sentry, DataDog)
7. **Logging**: Centralized logging solution
8. **Security**: Firewall rules, rate limiting, input validation

---

## Scan Results and Exports

### Export Files Location

All scan exports (CSV, JSON) are saved in:

```
orchestration-backend/api/exports/
```

### External Surface Monitoring - CSV Exports

When you select **CSV** as the output format for External Surface Monitoring scans, the CSV files are saved in the exports directory.

**File naming format:**
```
spiderfoot_{scan_id}_{target}.csv
```

Example: `spiderfoot_spiderfoot-12345-67890_codeforces_com.csv`

**CSV File Structure:**
- `type`: Entity type (e.g., INTERNET_NAME, IP_ADDRESS)
- `value`: Entity value (e.g., domain name, IP address)
- `module`: SpiderFoot module that discovered it (e.g., sfp_subdomain)
- `scan_id`: Unique scan identifier
- `target`: Target domain scanned
- `timestamp`: When the entity was discovered

**Downloading CSV Files:**

1. **Via Frontend:** After a scan completes with CSV format, a "Download CSV" button appears in the results section
2. **Via API:** 
   ```bash
   curl http://localhost:8000/api/v1/external-surface/download/{filename}
   ```
3. **Direct Access:** Navigate to `orchestration-backend/api/exports/` directory

### DMARC Monitoring - JSON Exports

DMARC analysis results are automatically saved as JSON files in the exports directory.

**File naming format:**
```
dmarc_{domain}_{timestamp}.json
```

Example: `dmarc_codeforces_com_20241130_180530.json`

**JSON File Structure:**
- `domain`: Analyzed domain
- `dmarc_policy`: DMARC policy details (policy, subdomain_policy, pct, rua, ruf, valid)
- `spf`: SPF record information (record, valid, dns_lookups, parsed)
- `dkim`: DKIM records and validation status
- `analysis_config`: Configuration used for the analysis
- `reports`: Email report data (if email parsing is configured)
- `status`: Analysis status
- `timestamp`: When the analysis was performed

**Downloading JSON Files:**

1. **Via Frontend:** Click the "Export JSON" button in the DMARC Analysis Results card header
2. **Via API:** 
   ```bash
   curl http://localhost:8000/api/v1/dmarc/download/{filename}
   ```
3. **Direct Access:** Navigate to `orchestration-backend/api/exports/` directory

**Note:** DMARC analysis results are automatically saved to disk when the analysis completes. The frontend also provides a direct download button for immediate access.

**Note:** CSV files are only generated when:
- Output format is set to "CSV" in the scan configuration
- The scan completes successfully
- Entities are discovered

---

## Support

For issues or questions:
- Check the [README.md](README.md) for architecture details
- Review API documentation at `http://localhost:8000/docs`
- Check logs in terminal output
- Review error messages in browser console (F12)

---

**Last Updated:** 2024
**Version:** 1.0.0

