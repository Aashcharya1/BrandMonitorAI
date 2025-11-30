# BrandMonitorAI

**AI-Powered Security Monitoring and Vulnerability Management Platform**

BrandMonitorAI is a comprehensive security monitoring and orchestration platform built on a modern microservices architecture. It integrates multiple security scanning tools (amass, masscan, nmap, Nessus) with AI-powered analysis capabilities, featuring a ChatGPT-like interface powered by LibreChat.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Features](#features)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Running the Application](#running-the-application)
7. [Configuration](#configuration)
8. [User Manual](#user-manual)
9. [Troubleshooting](#troubleshooting)
10. [Development](#development)
11. [Production Deployment](#production-deployment)

---

## 🏗️ Architecture Overview

BrandMonitorAI follows a **LibreChat-based microservices architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│                  http://localhost:9002                      │
│  - Active/Passive Monitoring Page                         │
│  - Chat Interface (LibreChat-powered)                     │
│  - Real-time Status Updates                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/API Requests
                     ▼
┌────────────────────────────────────────────────────────────┐
│              FastAPI Server (Central Orchestrator)          │
│                  http://localhost:8000                     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Auth       │  │   Memory     │  │   AI         │    │
│  │   (JWT +     │  │   Manager    │  │   Manager    │    │
│  │   Redis)     │  │   (Meili+   │  │   (Routes)   │    │
│  │              │  │   Redis)     │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │             │
│         ▼                 ▼                 ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  MongoDB     │  │  Redis       │  │  LibreChat   │    │
│  │  (Users +    │  │  (Session    │  │  (Chat API)  │    │
│  │   Chats)     │  │   Cache)     │  │              │    │
│  └──────────────┘  └──────────────┘  └──────┬───────┘    │
└─────────────────────────────────────────────┼──────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │   Celery Workers     │
                                   │  - Scan Orchestration│
                                   │  - Passive Scan      │
                                   │  - Active Scan       │
                                   │  - Nessus Scan       │
                                   │  - File Processing   │
                                   └──────────┬───────────┘
                                              │
                                              ▼
                          ┌───────────────────────────────────┐
                          │      Storage & Analytics          │
                          │  ┌──────────┐  ┌──────────┐      │
                          │  │ MongoDB  │  │PostgreSQL│      │
                          │  │(Users)   │  │(Results) │      │
                          │  └────┬─────┘  └──────────┘      │
                          │       │                           │
                          │       ▼                           │
                          │  ┌──────────┐  ┌──────────┐     │
                          │  │Elastic   │  │Meilisearch│     │
                          │  │search    │  │(Memory)   │     │
                          │  └────┬─────┘  └──────────┘     │
                          │       │                           │
                          │       ▼                           │
                          │  ┌──────────┐                     │
                          │  │ Kibana   │                     │
                          │  │Dashboard │                     │
                          │  └──────────┘                     │
                          └───────────────────────────────────┘
```

### Key Architectural Decisions

1. **Microservices Pattern**: Each component (auth, AI, memory, scanning) is independently scalable
2. **Async Task Processing**: Long-running scans use Celery workers
3. **Polyglot Persistence**: Different databases for different data types
4. **Caching Strategy**: Redis for sessions, Meilisearch for search
5. **Event-Driven**: Celery tasks communicate via message queue

---

## 💻 Technology Stack

### Frontend
- **Framework**: Next.js 15.3.3 (React 18+ with TypeScript)
- **UI Library**: TailwindCSS + shadcn/ui components
- **State Management**: React Hooks
- **HTTP Client**: Fetch API
- **Port**: 9002 (default)

### Backend (FastAPI)
- **Framework**: FastAPI 0.109.0
- **ASGI Server**: Uvicorn 0.27.0
- **Language**: Python 3.11+
- **Port**: 8000
- **API Documentation**: Swagger UI at `/docs`

### Authentication & Security
- **JWT**: PyJWT 2.8.0
- **Password Hashing**: passlib with bcrypt
- **Session Management**: Redis + JWT tokens
- **OAuth2 Support**: NextAuth.js (frontend)

### Task Queue & Workers
- **Celery**: 5.3.6
- **Broker**: Redis (default) or RabbitMQ
- **Result Backend**: Redis
- **Worker Pool**: Solo (Windows) / Prefork (Linux)

### Databases

#### MongoDB
- **Purpose**: User data, conversations, unstructured data
- **Driver**: Motor 3.3.2 (async), PyMongo 4.6.1

#### PostgreSQL
- **Purpose**: Structured data, scan results, relational data
- **Driver**: SQLAlchemy 2.0.25, psycopg2-binary 2.9.9

#### Redis
- **Purpose**: Session cache, task results, real-time data
- **Client**: redis-py 5.0.1

### Search & Analytics

#### Elasticsearch
- **Purpose**: Logs, scan results indexing, analytics
- **Client**: elasticsearch-py 8.12.1
- **Status**: Optional (cloud service supported)

#### Kibana
- **Purpose**: Visualization and dashboard for Elasticsearch data

#### Meilisearch
- **Purpose**: Conversation memory, fast search, context retrieval
- **Client**: meilisearch-py 0.31.2
- **Status**: Optional (cloud service supported)

### AI & Processing

#### LibreChat
- **Purpose**: ChatGPT-like interface for AI interactions
- **Integration**: Docker container (port 3080)
- **Status**: ✅ Fully integrated

#### AWS Bedrock
- **Purpose**: AI text generation (Claude, Llama, etc.)
- **Client**: boto3 1.34.34
- **Status**: Optional

#### OpenAI
- **Purpose**: Alternative AI provider
- **Client**: openai-py 1.12.0
- **Status**: Optional

### Security Scanning Tools

#### Amass (Passive Scanning)
- **Purpose**: Subdomain enumeration
- **Status**: Optional - has DNS fallback if not installed

#### Masscan (Port Discovery)
- **Purpose**: Fast port scanning
- **Status**: Optional - has port list fallback if not installed

#### Nmap (Active Scanning)
- **Purpose**: Service version detection, port scanning
- **Status**: Recommended - working with fallback to socket connections

#### Nessus (Vulnerability Scanning)
- **Purpose**: Vulnerability assessment
- **Status**: Optional - fully implemented with comprehensive error handling

### Infrastructure & DevOps
- **Docker**: Docker Compose configuration
- **Environment Variables**: python-dotenv
- **Logging**: Python logging module
- **CORS**: FastAPI CORSMiddleware configured

---

## ✨ Features

### Core Features
- ✅ **Multi-Tool Security Scanning**: Passive (amass), Active (masscan/nmap), Vulnerability (Nessus)
- ✅ **AI-Powered Chat Interface**: LibreChat integration for intelligent conversations
- ✅ **Real-time Scan Monitoring**: Live status updates and progress tracking
- ✅ **Comprehensive Dashboard**: Visual analytics and summary statistics
- ✅ **Asset Search**: Fast search across discovered assets using Meilisearch
- ✅ **Kibana Integration**: Rich visualization dashboards for scan results

### Advanced Features
- ✅ **Async Task Processing**: Celery workers for long-running operations
- ✅ **Graceful Fallbacks**: System continues working even if optional tools are missing
- ✅ **Multi-Database Support**: MongoDB, PostgreSQL, Redis, Elasticsearch, Meilisearch
- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Session Management**: Redis-backed session caching
- ✅ **Error Handling**: Comprehensive error messages and logging

---

## 📦 Prerequisites

### Required
- **Python**: 3.11 or higher
- **Node.js**: 18 or higher
- **Redis**: For Celery broker and session cache
- **MongoDB**: For user data and conversations
- **PostgreSQL**: For structured scan results

### Optional
- **Docker & Docker Compose**: For containerized deployment
- **Nessus**: For vulnerability scanning
- **Amass**: For enhanced passive subdomain enumeration
- **Masscan**: For faster port scanning
- **Nmap**: For service detection (recommended)

### Recommended
- **Elasticsearch + Kibana**: For advanced analytics
- **Meilisearch**: For fast asset search

---

## 🚀 Installation & Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd BrandMonitorAI
```

### Step 2: Install Databases

#### MongoDB

**Windows:**
1. Download: https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. Verify: `mongosh mongodb://localhost:27017/brandmonitorai`

**Linux (WSL):**
```bash
wsl
sudo apt update
sudo apt install mongodb -y
sudo service mongodb start
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

#### PostgreSQL

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Install and set password
3. Create database: `createdb -U postgres brandmonitorai`

**Linux (WSL):**
```bash
wsl
sudo apt install postgresql postgresql-contrib -y
sudo service postgresql start
sudo -u postgres createdb brandmonitorai
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-password';"
```

**Docker:**
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=your-password --name postgres postgres:15-alpine
```

#### Redis

**Windows (Docker - Recommended):**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Linux (WSL):**
```bash
wsl
sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping  # Should return: PONG
```

### Step 3: Environment Variables Setup

#### Frontend `.env.local` (Root Directory)

Create `F:\Zeroshield\BrandMonitorAI\.env.local`:

```env
# FastAPI Backend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MONITOR_API_URL=http://localhost:8000

# NextAuth
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=your-generated-secret-key

# MongoDB
MONGODB_URI=mongodb://localhost:27017/brandmonitorai

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# LibreChat
LIBRECHAT_URL=http://localhost:3080
```

**Generate NEXTAUTH_SECRET:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Backend `.env` (orchestration-backend/api/.env)

Create `orchestration-backend/api/.env`:

```env
# FastAPI Server
PORT=8000
HOST=0.0.0.0

# MongoDB (User data & conversations)
MONGODB_URI=mongodb://localhost:27017/brandmonitorai

# PostgreSQL (Structured data)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=brandmonitorai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-postgres-password

# Redis (Session cache & task results) - REQUIRED
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Elasticsearch + Kibana (Optional)
ES_URL=https://your-elasticsearch-url:443
ES_API_KEY=your-api-key
ES_ASSET_INDEX=assets

# Meilisearch (Optional)
MEILI_URL=https://your-meilisearch-url
MEILI_KEY=your-api-key
MEILI_INDEX=conversation_memory

# Nessus (Optional - for vulnerability scanning)
NESSUS_URL=https://localhost:8834
NESSUS_ACCESS_KEY=your-access-key
NESSUS_SECRET_KEY=your-secret-key

# JWT Authentication
JWT_SECRET=your-jwt-secret-change-this-to-random-value
JWT_ALGORITHM=HS256
JWT_EXPIRATION=86400

# LibreChat / OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CUSTOM_JWT_SECRET=your-long-random-string
JWT_SECRET=your-long-random-string

# AWS Bedrock (Optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_BEDROCK_ENABLED=true

# AI Providers (Optional)
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
```

### Step 4: Backend Setup

```powershell
cd orchestration-backend\api

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Initialize PostgreSQL tables
python -c "from database.postgres import init_postgres_tables; init_postgres_tables(); print('Tables created')"

# Create uploads directory
mkdir uploads
```

### Step 5: Frontend Setup

```powershell
# In root directory
npm install
```

### Step 6: Install Scanning Tools (Optional)

#### Nmap (Recommended)

**Windows:**
1. Download: https://nmap.org/download.html
2. Install and add to PATH
3. Verify: `nmap --version`

**Linux/Mac:**
```bash
sudo apt-get install nmap -y  # Ubuntu/Debian
brew install nmap              # Mac
```

#### Amass (Optional)

**Windows:**
1. Download: https://github.com/OWASP/Amass/releases
2. Extract and add to PATH

**Linux:**
```bash
sudo apt-get install amass -y
```

#### Masscan (Optional)

**Windows:**
1. Download: https://github.com/robertdavidgraham/masscan/releases
2. Place in folder and add to PATH

**Linux:**
```bash
sudo apt-get install masscan -y
```

#### Nessus (Optional)

1. Download: https://www.tenable.com/downloads/nessus
2. Install and start Nessus service
3. Access web interface: `https://localhost:8834`
4. Create admin account and generate API keys
5. Add keys to `.env` file

**Note**: The system has fallbacks for all optional tools. Scans will work without them, but with limited functionality.

### Step 7: Docker Compose Setup (Optional)

If using Docker Compose:

```bash
cd orchestration-backend/api
docker compose up -d
```

This starts:
- FastAPI backend
- Celery worker
- PostgreSQL
- Redis
- MongoDB
- LibreChat

---

## ▶️ Running the Application

### Development Mode

You need **multiple terminals** running simultaneously:

#### Terminal 1: PostgreSQL (if not using Docker)

```bash
# Windows (WSL)
wsl
sudo service postgresql start

# Linux
sudo service postgresql start
```

#### Terminal 2: MongoDB (if not using Docker)

```powershell
# Windows (if installed as service, it should auto-start)
# Or:
mongod --dbpath "C:\data\db"

# Linux
sudo service mongodb start
```

#### Terminal 3: Redis (if not using Docker)

```bash
# Windows (Docker)
docker start redis

# Linux
sudo service redis-server start
```

#### Terminal 4: Celery Worker

```powershell
cd orchestration-backend\api
.\venv\Scripts\activate
celery -A celery_app worker --loglevel=info --pool=solo  # Windows
# celery -A celery_app worker --loglevel=info            # Linux/Mac
```

**Expected output:**
```
celery@hostname v5.3.6 (singularity)
[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@hostname ready.
```

#### Terminal 5: FastAPI Backend

```powershell
cd orchestration-backend\api
.\venv\Scripts\activate
python main.py
```

**Or with uvicorn:**
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected output:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
✓ MongoDB connected
✓ PostgreSQL connected and tables initialized
✓ Redis connected
INFO:     Application startup complete.
```

**Test API:**
- Swagger UI: http://localhost:8000/docs
- Health: http://localhost:8000/health

#### Terminal 6: Next.js Frontend

```powershell
# In root directory
npm run dev
```

**Expected output:**
```
▲ Next.js 15.3.3
- Local:        http://localhost:9002
✓ Ready in 2.3s
```

**Open browser:** http://localhost:9002

#### Terminal 7: LibreChat (if using Docker Compose)

```bash
cd orchestration-backend/api
docker compose up -d librechat
```

Verify LibreChat is running:
```bash
curl http://localhost:3080/api/models
```

---

## ⚙️ Configuration

### Environment Variables

All configuration is done via environment variables. See [Step 3: Environment Variables Setup](#step-3-environment-variables-setup) for complete `.env` templates.

### Key Configuration Points

1. **Redis**: Required for Celery and session management
2. **MongoDB**: Required for user data and conversations
3. **PostgreSQL**: Required for structured scan results
4. **Elasticsearch**: Optional, for advanced analytics
5. **Meilisearch**: Optional, for fast asset search
6. **Nessus**: Optional, for vulnerability scanning
7. **LibreChat**: Integrated via Docker Compose

### Scanning Tools Configuration

The system automatically detects available scanning tools and uses fallbacks if tools are missing:

- **Amass not available**: Uses DNS resolution for common subdomains
- **Masscan not available**: Uses predefined common ports list
- **Nmap not available**: Uses Python socket connections
- **Nessus not configured**: Skips vulnerability scanning (other scans continue)

---

## 📖 User Manual

### Getting Started

1. **Register/Login**: Navigate to http://localhost:9002/register or /login
2. **Access Dashboard**: After login, you'll see the main dashboard
3. **Start Monitoring**: Click "Monitoring" in the sidebar to access scan configuration

### Active/Passive Monitoring

1. **Navigate to Monitoring Page**: Click "Monitoring" in the sidebar
2. **Configure Scan**:
   - Enter target domain (e.g., `example.com`)
   - Enable scan types:
     - **Passive Recon**: Subdomain enumeration (amass)
     - **Active Scan**: Port and service detection (masscan + nmap)
     - **Vulnerability**: Vulnerability assessment (Nessus)
   - Optionally specify Nessus policy UUID
3. **Start Scan**: Click "Start Scan" button
4. **Monitor Progress**: Watch real-time status updates
5. **View Results**: Results appear automatically when scan completes

### Chat Interface

1. **Navigate to Chat**: Click "Chat" in the sidebar
2. **Send Messages**: Type questions and receive AI-powered responses
3. **Context Awareness**: The system maintains conversation context using Meilisearch

### Search Assets

After a scan completes:
1. Use the search bar on the monitoring page
2. Search by domain, hostname, IP, or service
3. View detailed asset information

### Viewing Results

- **Kibana Dashboard**: Embedded dashboard shows visualizations
- **Summary Cards**: Quick stats on the monitoring page
- **Asset Details**: Click on assets for detailed information

---

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::8000`

**Solution**:
```powershell
# Find process using port
netstat -ano | findstr :8000
# Kill process
taskkill /PID <PID> /F
```

#### Redis Connection Failed

**Error**: `Connection refused` or `DisabledBackend`

**Solution**:
1. Verify Redis is running: `redis-cli ping` (should return `PONG`)
2. Check `.env` has `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` set
3. Restart FastAPI server after changing `.env`

#### Tasks Stuck in "Queued"

**Cause**: No Celery worker is running

**Solution**:
1. Start Celery worker in a separate terminal:
   ```powershell
   cd orchestration-backend\api
   celery -A celery_app worker --loglevel=info --pool=solo  # Windows
   ```
2. Verify worker shows: `celery@hostname ready.`

#### Windows: billiard/pool.py Error

**Error**: `File "billiard\pool.py", line 473`

**Cause**: Using prefork pool on Windows (not supported)

**Solution**: Always use `--pool=solo` on Windows:
```powershell
celery -A celery_app worker --loglevel=info --pool=solo
```

#### Database Connection Errors

**PostgreSQL**:
```powershell
psql -h localhost -U postgres -d brandmonitorai
```

**MongoDB**:
```powershell
mongosh mongodb://localhost:27017/brandmonitorai
```

**Redis**:
```powershell
redis-cli ping  # Should return: PONG
```

#### Nessus Not Responding

**Check**:
1. Nessus service is running
2. Accessible at configured URL (usually `https://localhost:8834`)
3. API keys are correct in `.env`
4. Policy exists in Nessus

**Note**: Nessus is optional - scans work without it

#### LibreChat Not Responding

**Check**:
1. LibreChat container is running: `docker compose ps`
2. MongoDB is running (required for LibreChat)
3. JWT secret is configured in `docker-compose.yml`
4. OpenAI API key is set in `.env`

**Verify**:
```bash
curl http://localhost:3080/api/models
```

#### Frontend Not Connecting to Backend

**Check**:
1. FastAPI server is running: http://localhost:8000/health
2. CORS settings in `main.py` allow your frontend origin
3. `NEXT_PUBLIC_API_URL` in `.env.local` is correct

---

## 💻 Development

### Project Structure

```
BrandMonitorAI/
├── orchestration-backend/
│   └── api/
│       ├── main.py              # FastAPI entry point
│       ├── celery_app.py        # Celery configuration
│       ├── tasks.py             # Celery tasks
│       ├── requirements.txt
│       ├── .env                 # Backend environment variables
│       ├── routers/             # API route handlers
│       ├── services/            # Business logic
│       ├── database/            # Database connections
│       └── models/              # Data models
├── src/
│   ├── app/                     # Next.js pages
│   ├── components/              # React components
│   └── lib/                     # Utilities
├── .env.local                   # Frontend environment variables
└── package.json                 # Frontend dependencies
```

### Adding New Features

1. **Backend API**: Add routes in `routers/`
2. **Celery Tasks**: Add tasks in `tasks.py`
3. **Frontend Pages**: Add pages in `src/app/`
4. **Components**: Add reusable components in `src/components/`

### Testing

Currently, testing is manual. To test:

1. **API Endpoints**: Use Swagger UI at http://localhost:8000/docs
2. **Frontend**: Use browser dev tools (F12)
3. **Celery Tasks**: Check worker logs

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Change all default secrets (JWT_SECRET, NEXTAUTH_SECRET)
- [ ] Use environment-specific database URLs
- [ ] Enable SSL/TLS for all connections
- [ ] Set up proper CORS origins
- [ ] Configure production Docker Compose
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Enable request logging
- [ ] Set up monitoring and alerting

### Docker Compose Production

```bash
cd orchestration-backend/api
docker compose -f docker-compose.prod.yml up -d
```

### Environment Separation

Use different `.env` files for dev/staging/prod:
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

### Security Considerations

- Store secrets in environment variables (never commit)
- Use HTTPS in production
- Enable authentication for all endpoints
- Rotate API keys periodically
- Limit network access to services
- Use firewall rules

---

## 📊 Current Status

### ✅ Completed Components

- Core Backend Infrastructure
- Authentication System (JWT + Redis)
- Database Connections (MongoDB, PostgreSQL, Redis)
- Celery Task Queue
- Security Scanning Infrastructure (all 4 scan types)
- Frontend Monitoring Interface
- LibreChat Integration
- API Endpoints
- Memory Management Service
- Elasticsearch Integration

### ⚠️ Partially Implemented

- AI Endpoint Manager (structure in place, needs testing)
- File Processing (requires Tesseract OCR)
- OAuth2 Integration (needs provider credentials)

### ❌ Not Implemented

- Production deployment configuration
- Automated testing suite
- Advanced monitoring (APM, Prometheus)
- CI/CD pipeline
- Multi-tenant support
- Scheduled scans

---

## 📝 License

[Add your license here]

---

## 🙏 Credits

- Architecture inspired by **LibreChat**
- Built with modern best practices
- Designed for scalability and maintainability

---

## 📞 Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review logs in Celery worker and FastAPI server
- Check Swagger UI documentation at `/docs`

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Status**: Active Development

