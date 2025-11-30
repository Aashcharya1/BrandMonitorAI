"""
AI Endpoint Manager
Routes AI requests to AWS Bedrock, Transformers/PyTorch, OpenAI, Anthropic, etc.
LibreChat Architecture: Central router for AI model orchestration
"""

import os
import logging
from typing import Dict, Any, Optional, List
from services.mcp_server import mcp_server
from services.memory_manager import memory_manager
try:
    from services.aws_bedrock import bedrock_client
except ImportError:
    bedrock_client = None

logger = logging.getLogger(__name__)

class AIEndpointManager:
    """
    Manages AI endpoint routing and processing.
    Routes requests to:
    - AWS Bedrock (managed foundation models)
    - Transformers/PyTorch (custom models)
    - OpenAI, Anthropic, Google (external APIs)
    All responses pass through MCP Middleware for processing.
    """
    
    def __init__(self):
        self.providers = {
            'bedrock': self._call_bedrock,
            'openai': self._call_openai,
            'anthropic': self._call_anthropic,
            'google': self._call_google,
            'transformers': self._call_transformers
        }
    
    async def process(self, message: str, user_id: Optional[str] = None,
                     conversation_id: Optional[str] = None,
                     model: Optional[str] = None, 
                     provider: Optional[str] = None,
                     context: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Process AI request following LibreChat flow:
        1. Retrieve context from memory (Meilisearch)
        2. Route through MCP Server (pre-processing)
        3. Call appropriate AI provider
        4. Process response through MCP Middleware
        5. Store conversation in MongoDB
        """
        # Retrieve relevant context from memory
        retrieved_context = []
        if user_id:
            retrieved_context = await memory_manager.search_context(user_id, message, limit=5)
        
        # Combine user context and retrieved context
        full_context = (context or []) + retrieved_context
        
        # Determine provider
        if not provider:
            provider = self._detect_provider(model)
        
        if provider not in self.providers:
            raise ValueError(f"Unsupported provider: {provider}")
        
        # Prepare request with context
        request = {
            "message": message,
            "model": model,
            "provider": provider,
            "context": full_context,
            "user_id": user_id,
            "conversation_id": conversation_id
        }
        
        # Route through MCP Server (pre-processing)
        processed_request = await mcp_server.process_request(request)
        
        # Call provider
        handler = self.providers[provider]
        raw_response = await handler(processed_request)
        
        # Process response through MCP Middleware (post-processing)
        final_response = await mcp_server.process_response(raw_response)
        
        # Store conversation in memory (async, don't await)
        if user_id and conversation_id:
            memory_manager.update_memory(
                user_id, conversation_id, 
                message, final_response.get('response', ''),
                metadata={'provider': provider, 'model': model}
            )
        
        return final_response
    
    def _detect_provider(self, model: Optional[str]) -> str:
        """Detect provider from model name"""
        if not model:
            return 'openai'  # Default
        
        model_lower = model.lower()
        if 'bedrock' in model_lower or 'claude' in model_lower:
            return 'bedrock'
        elif 'gpt' in model_lower or 'openai' in model_lower:
            return 'openai'
        elif 'anthropic' in model_lower:
            return 'anthropic'
        elif 'gemini' in model_lower or 'google' in model_lower:
            return 'google'
        elif 'transformers' in model_lower or 'pytorch' in model_lower:
            return 'transformers'
        return 'openai'
    
    async def _call_bedrock(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Call AWS Bedrock"""
        if not bedrock_client or not bedrock_client.bedrock_runtime:
            raise ValueError("AWS Bedrock not configured. Set AWS_BEDROCK_ENABLED=true and provide credentials.")
        
        try:
            message = request.get('message', '')
            model = request.get('model', 'anthropic.claude-v2')
            
            # Build prompt with context
            context_text = self._format_context(request.get('context', []))
            full_prompt = f"{context_text}\n\nUser: {message}\n\nAssistant:"
            
            response = await bedrock_client.generate_text(
                prompt=full_prompt,
                model_id=model
            )
            return response
        except Exception as e:
            logger.error(f"AWS Bedrock call failed: {e}")
            raise
    
    async def _call_openai(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Call OpenAI API"""
        # TODO: Implement OpenAI API call
        logger.info("Calling OpenAI (not implemented)")
        return {"response": "OpenAI not implemented", "provider": "openai"}
    
    async def _call_anthropic(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Call Anthropic API"""
        # TODO: Implement Anthropic API call
        logger.info("Calling Anthropic (not implemented)")
        return {"response": "Anthropic not implemented", "provider": "anthropic"}
    
    async def _call_google(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Call Google AI API"""
        # TODO: Implement Google AI API call
        logger.info("Calling Google AI (not implemented)")
        return {"response": "Google AI not implemented", "provider": "google"}
    
    async def _call_transformers(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Call local Transformers/PyTorch model"""
        # TODO: Implement Transformers/PyTorch model call
        logger.info("Calling Transformers/PyTorch (not implemented)")
        return {"response": "Transformers not implemented", "provider": "transformers"}
    
    def _format_context(self, context: List[Dict]) -> str:
        """Format context for prompt"""
        if not context:
            return ""
        
        formatted = "Previous conversation context:\n"
        for item in context[-5:]:  # Last 5 context items
            msg = item.get('message', '')
            resp = item.get('response', '')
            formatted += f"User: {msg}\nAssistant: {resp}\n\n"
        
        return formatted

ai_manager = AIEndpointManager()

