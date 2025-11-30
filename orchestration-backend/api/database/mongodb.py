"""
MongoDB Connection Manager
For user data and chat logs
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
import logging

logger = logging.getLogger(__name__)

mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/brandmonitorai')
client = None
db = None

def get_mongodb_client():
    """Get synchronous MongoDB client"""
    global client
    if client is None:
        client = MongoClient(mongodb_uri)
        logger.info("MongoDB client connected")
    return client

def get_mongodb_db():
    """Get MongoDB database"""
    global db
    if db is None:
        client = get_mongodb_client()
        db_name = mongodb_uri.split('/')[-1].split('?')[0]
        db = client[db_name]
    return db

async def get_async_mongodb_client():
    """Get async MongoDB client"""
    client = AsyncIOMotorClient(mongodb_uri)
    return client

