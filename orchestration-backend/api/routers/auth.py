"""
Authentication Router
JWT, AWS Cognito, OAuth2, LDAP support
LibreChat Architecture: Validates sessions via Redis cache
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import jwt
from datetime import datetime, timedelta
from services.memory_manager import memory_manager
from database.mongodb import get_mongodb_db

router = APIRouter()
security = HTTPBearer()

JWT_SECRET = os.getenv('JWT_SECRET', 'change-this-secret')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginRequest(BaseModel):
    email: str
    password: str

async def verify_jwt_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

@router.post("/auth/verify")
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify JWT token.
    LibreChat Architecture: Validates token and checks Redis session cache.
    """
    token = credentials.credentials
    
    # Verify JWT
    payload = await verify_jwt_token(token)
    user_id = payload.get('sub') or payload.get('user_id')
    
    # Validate session in Redis cache
    if user_id:
        is_valid = memory_manager.validate_session(user_id)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found in cache"
            )
    
    return {
        "valid": True,
        "user_id": user_id,
        "payload": payload
    }

@router.get("/auth/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current authenticated user.
    LibreChat Architecture: Retrieves user from MongoDB and session from Redis.
    """
    token = credentials.credentials
    
    # Verify token
    payload = await verify_jwt_token(token)
    user_id = payload.get('sub') or payload.get('user_id')
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Get session from Redis
    session = memory_manager.get_session(user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired"
        )
    
    # Get user from MongoDB
    try:
        db = get_mongodb_db()
        user = db.users.find_one({'email': payload.get('email')})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "id": str(user.get('_id')),
            "email": user.get('email'),
            "name": user.get('name'),
            "session": session
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

