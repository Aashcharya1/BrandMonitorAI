"""
AI Endpoint Router - AI Model Orchestration
LibreChat Architecture: Routes AI requests through MCP Middleware
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
try:
    from services.ai_manager import ai_manager
    from services.memory_manager import memory_manager
    from routers.auth import verify_jwt_token
except ImportError:
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from services.ai_manager import ai_manager
    from services.memory_manager import memory_manager
    from routers.auth import verify_jwt_token

router = APIRouter()
security = HTTPBearer()

class AIRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    context: Optional[List[Dict[str, Any]]] = None
    stream: bool = False

class AIResponse(BaseModel):
    response: str
    model: str
    provider: str
    tokens_used: Optional[int] = None
    conversation_id: Optional[str] = None

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[str]:
    """Extract user ID from JWT token"""
    try:
        payload = await verify_jwt_token(credentials.credentials)
        return payload.get('sub') or payload.get('user_id')
    except:
        return None

@router.post("/ai/chat")
async def chat(
    request: AIRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    AI chat endpoint - LibreChat Architecture flow:
    1. Validate JWT token (Redis session cache)
    2. Retrieve context from Meilisearch memory
    3. Route through AI Manager → MCP Middleware → AWS Bedrock/OpenAI/etc
    4. Process response through MCP Middleware
    5. Store conversation in MongoDB
    6. Update memory in Meilisearch
    """
    try:
        # Verify JWT and get user ID
        user_id = await get_current_user_id(credentials)
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"conv_{user_id}_{int(__import__('time').time())}"
        
        # Process AI request
        result = await ai_manager.process(
            message=request.message,
            user_id=user_id,
            conversation_id=conversation_id,
            model=request.model,
            provider=request.provider,
            context=request.context
        )
        
        return {
            "response": result.get("response", "No response"),
            "model": request.model or result.get("model", "default"),
            "provider": result.get("provider", "unknown"),
            "conversation_id": conversation_id,
            "message": request.message
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/process")
async def process_with_ai(
    request: AIRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Process data with AI models (non-chat use case)"""
    try:
        user_id = await get_current_user_id(credentials)
        
        result = await ai_manager.process(
            message=request.message,
            user_id=user_id,
            model=request.model,
            provider=request.provider,
            context=request.context
        )
        return {
            "status": "processed",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

