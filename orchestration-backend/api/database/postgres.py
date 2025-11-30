"""
PostgreSQL Connection Manager
For structured data
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import os
import logging

logger = logging.getLogger(__name__)

POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'brandmonitorai')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')

SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = None
SessionLocal = None
Base = declarative_base()

def get_postgres_engine():
    """Get PostgreSQL engine"""
    global engine
    if engine is None:
        try:
            engine = create_engine(
                SQLALCHEMY_DATABASE_URL,
                poolclass=NullPool,
                echo=False
            )
            logger.info("PostgreSQL engine created")
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            engine = None
    return engine

def get_postgres_session():
    """Get PostgreSQL session"""
    global SessionLocal
    if SessionLocal is None:
        engine = get_postgres_engine()
        if engine:
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def init_postgres_tables():
    """Initialize PostgreSQL tables"""
    if engine:
        Base.metadata.create_all(bind=engine)

