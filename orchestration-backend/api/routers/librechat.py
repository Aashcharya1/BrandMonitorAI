"""
LibreChat Integration Router
"""

from fastapi import APIRouter, HTTPException
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/librechat/token")
async def librechat_token():
    """Issue a simple JWT for LibreChat. In production, add auth guard."""
    logger.info("LibreChat token endpoint called")
    try:
        import jwt
        
        secret = os.getenv("JWT_SECRET") or os.getenv("CUSTOM_JWT_SECRET")
        if not secret:
            # Fallback to a default secret for development
            secret = "dev-secret-key-change-in-production"
            logger.warning("Using default JWT secret. Set JWT_SECRET environment variable in production.")
        
        payload = {"sub": "demo-user"}
        token = jwt.encode(payload, secret, algorithm="HS256")
        logger.info("Token generated successfully")
        return {"token": token}
    except ImportError:
        # Fallback: Generate a simple token without PyJWT for development
        logger.warning("PyJWT not installed; using simple token for development.")
        import base64
        import json
        from datetime import datetime
        
        # Create a simple base64-encoded token for development
        payload = {
            "sub": "demo-user",
            "iat": int(datetime.now().timestamp()),
            "exp": int(datetime.now().timestamp()) + 3600  # 1 hour
        }
        token_data = json.dumps(payload)
        token = base64.b64encode(token_data.encode()).decode()
        logger.info("Fallback token generated successfully")
        return {"token": f"dev.{token}"}
    except Exception as e:
        logger.error(f"Error generating token: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate token: {str(e)}")

