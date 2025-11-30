"""
Memory & Context Management Service
Uses Meilisearch for conversation memory and Redis for session cache
"""

import os
import logging
from typing import Dict, Any, Optional, List
from meilisearch import Client as MeiliClient
import redis
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class MemoryManager:
    """Manages conversation memory and context retrieval"""
    
    def __init__(self):
        # Meilisearch for conversation memory
        meili_url = os.getenv('MEILI_URL')
        meili_key = os.getenv('MEILI_KEY')
        self.meili_index = os.getenv('MEILI_INDEX', 'conversation_memory')
        
        if meili_url and meili_key:
            try:
                self.meili = MeiliClient(meili_url, meili_key)
                # Create index if it doesn't exist
                try:
                    self.meili.get_index(self.meili_index)
                except:
                    self.meili.create_index(self.meili_index, {'primaryKey': 'id'})
                    logger.info(f"Created Meilisearch index: {self.meili_index}")
            except Exception as e:
                logger.error(f"Meilisearch initialization failed: {e}")
                self.meili = None
        else:
            logger.warning("Meilisearch not configured")
            self.meili = None
        
        # Redis for session cache
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis_client = None
    
    async def update_memory(self, user_id: str, conversation_id: str, 
                           message: str, response: str, metadata: Optional[Dict] = None) -> bool:
        """Update conversation memory in Meilisearch"""
        if not self.meili:
            return False
        
        try:
            doc = {
                'id': f"{user_id}:{conversation_id}:{int(datetime.utcnow().timestamp())}",
                'user_id': user_id,
                'conversation_id': conversation_id,
                'message': message,
                'response': response,
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': metadata or {}
            }
            
            self.meili.index(self.meili_index).add_documents([doc])
            logger.info(f"Updated memory for conversation: {conversation_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update memory: {e}")
            return False
    
    async def search_context(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search conversation history for relevant context"""
        if not self.meili:
            return []
        
        try:
            # Search in user's conversation history
            search_params = {
                'filter': f'user_id = "{user_id}"',
                'limit': limit,
                'attributesToRetrieve': ['message', 'response', 'timestamp', 'metadata']
            }
            
            results = self.meili.index(self.meili_index).search(query, search_params)
            return results.get('hits', [])
        except Exception as e:
            logger.error(f"Context search failed: {e}")
            return []
    
    def cache_session(self, user_id: str, session_data: Dict[str, Any], ttl: int = 3600) -> bool:
        """Cache session data in Redis"""
        if not self.redis_client:
            return False
        
        try:
            key = f"session:{user_id}"
            self.redis_client.setex(key, ttl, json.dumps(session_data))
            return True
        except Exception as e:
            logger.error(f"Failed to cache session: {e}")
            return False
    
    def get_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data from Redis"""
        if not self.redis_client:
            return None
        
        try:
            key = f"session:{user_id}"
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Failed to get session: {e}")
            return None
    
    def validate_session(self, user_id: str) -> bool:
        """Validate if session exists in Redis"""
        if not self.redis_client:
            return False
        
        try:
            key = f"session:{user_id}"
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Session validation failed: {e}")
            return False
    
    def invalidate_session(self, user_id: str) -> bool:
        """Remove session from Redis"""
        if not self.redis_client:
            return False
        
        try:
            key = f"session:{user_id}"
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to invalidate session: {e}")
            return False

# Global memory manager instance
memory_manager = MemoryManager()

