"""
FastAPI Main Application
LibreChat-based Architecture for BrandMonitorAI
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routers
try:
    from routers import monitoring, ai, auth, files, librechat, external_surface, dmarc, dns, data_leaks, takedown
except ImportError:
    # Fallback for development
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))
    from routers import monitoring, ai, auth, files, librechat, external_surface, dmarc, dns, data_leaks, takedown

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting FastAPI application (LibreChat Architecture)...")
    logger.info("Initializing database connections...")
    
    # Initialize database connections (non-blocking - allow server to start even if some fail)
    try:
        from database.mongodb import get_mongodb_client, get_mongodb_db
        try:
            mongo_client = get_mongodb_client()
            logger.info("✓ MongoDB connected")
        except Exception as e:
            logger.warning(f"⚠ MongoDB connection failed: {e}. Server will continue but MongoDB features will be unavailable.")
    except ImportError:
        logger.warning("⚠ MongoDB module not found. MongoDB features will be unavailable.")
    
    try:
        from database.postgres import get_postgres_engine, init_postgres_tables
        try:
            postgres_engine = get_postgres_engine()
            if postgres_engine:
                init_postgres_tables()
                logger.info("✓ PostgreSQL connected and tables initialized")
        except Exception as e:
            logger.warning(f"⚠ PostgreSQL connection failed: {e}. Server will continue but PostgreSQL features will be unavailable.")
    except ImportError:
        logger.warning("⚠ PostgreSQL module not found. PostgreSQL features will be unavailable.")
    
    try:
        from services.memory_manager import memory_manager
        try:
            if memory_manager.redis_client:
                logger.info("✓ Redis connected")
            else:
                logger.warning("⚠ Redis client not initialized. Redis features will be unavailable.")
        except Exception as e:
            logger.warning(f"⚠ Redis connection failed: {e}. Server will continue but Redis features will be unavailable.")
    except ImportError:
        logger.warning("⚠ Memory manager module not found. Redis and Meilisearch features will be unavailable.")
    except Exception as e:
        logger.warning(f"⚠ Memory manager initialization failed: {e}")
    
    try:
        from services.memory_manager import memory_manager
        if hasattr(memory_manager, 'meili') and memory_manager.meili:
            logger.info("✓ Meilisearch connected")
        else:
            logger.warning("⚠ Meilisearch not configured. Search features will be unavailable.")
    except:
        pass  # Already logged above
    
    logger.info("Server initialization complete. Some services may be unavailable but API is ready.")
    
    # Verify librechat endpoint is registered
    routes = [getattr(route, 'path', str(route)) for route in app.routes]
    librechat_routes = [r for r in routes if 'librechat' in str(r).lower()]
    if librechat_routes:
        logger.info(f"✓ LibreChat routes found: {librechat_routes}")
    else:
        logger.warning(f"⚠ LibreChat routes not found in: {routes[:5]}...")
    
    # Verify DMARC endpoint is registered
    dmarc_routes = [r for r in routes if 'dmarc' in str(r).lower()]
    if dmarc_routes:
        logger.info(f"✓ DMARC routes found: {dmarc_routes[:5]}...")
    else:
        logger.warning(f"⚠ DMARC routes not found in: {routes[:10]}...")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")

# Create FastAPI app
app = FastAPI(
    title="BrandMonitorAI API",
    description="LibreChat-based backend for security monitoring and orchestration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9002", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoints (register before routers to avoid conflicts)
@app.get("/")
async def root():
    return {"message": "BrandMonitorAI API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health():
    """Health check endpoint - doesn't require all services to be connected"""
    return {
        "status": "healthy",
        "message": "API server is running",
        "version": "1.0.0"
    }

# Include routers
# Register librechat router FIRST to ensure it's not overridden
app.include_router(librechat.router, prefix="/api/v1", tags=["librechat"])
app.include_router(monitoring.router, prefix="/api/v1", tags=["monitoring"])
app.include_router(external_surface.router, prefix="/api/v1", tags=["external-surface"])
app.include_router(dmarc.router, prefix="/api/v1", tags=["dmarc"])
app.include_router(dns.router, prefix="/api/v1", tags=["dns"])
app.include_router(data_leaks.router, prefix="/api/v1", tags=["data-leaks"])
app.include_router(takedown.router, prefix="/api/v1", tags=["takedown"])
app.include_router(ai.router, prefix="/api/v1", tags=["ai"])
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(files.router, prefix="/api/v1", tags=["files"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

