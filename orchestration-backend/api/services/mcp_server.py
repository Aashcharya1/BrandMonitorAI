"""
MCP Server Middleware
Model Context Protocol - Processes and routes AI requests/responses
LibreChat Architecture: Middleware layer for AI processing
"""

import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class MCPServer:
    """
    Model Context Protocol Server - Middleware for AI processing.
    Handles:
    - Pre-processing requests before sending to AI models
    - Post-processing responses from AI models
    - Agent routing and management
    - Response formatting and validation
    """
    
    def __init__(self):
        self.agents = {}
        self.processors = {
            'pre': [],  # Pre-processing functions
            'post': []  # Post-processing functions
        }
    
    def register_agent(self, name: str, agent_class):
        """Register an AI agent for task-specific processing"""
        self.agents[name] = agent_class
        logger.info(f"Registered agent: {name}")
    
    def register_pre_processor(self, name: str, processor_func):
        """Register a pre-processing function"""
        self.processors['pre'].append((name, processor_func))
        logger.info(f"Registered pre-processor: {name}")
    
    def register_post_processor(self, name: str, processor_func):
        """Register a post-processing function"""
        self.processors['post'].append((name, processor_func))
        logger.info(f"Registered post-processor: {name}")
    
    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process AI request through MCP middleware (pre-processing).
        Applies all registered pre-processors before routing to AI provider.
        """
        processed = request.copy()
        
        # Apply pre-processors
        for name, processor in self.processors['pre']:
            try:
                processed = await processor(processed)
                logger.debug(f"Applied pre-processor: {name}")
            except Exception as e:
                logger.error(f"Pre-processor {name} failed: {e}")
                continue
        
        # Route to agent if specified
        agent_name = processed.get('agent')
        if agent_name and agent_name in self.agents:
            agent = self.agents[agent_name]
            processed = await agent.process(processed)
        
        return processed
    
    async def process_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process AI response through MCP middleware (post-processing).
        Applies all registered post-processors after receiving from AI provider.
        """
        processed = response.copy()
        
        # Apply post-processors
        for name, processor in self.processors['post']:
            try:
                processed = await processor(processed)
                logger.debug(f"Applied post-processor: {name}")
            except Exception as e:
                logger.error(f"Post-processor {name} failed: {e}")
                continue
        
        return processed
    
    async def route_to_agent(self, agent_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Route request to specific agent"""
        if agent_name not in self.agents:
            raise ValueError(f"Agent {agent_name} not found")
        
        agent = self.agents[agent_name]
        return await agent.process(payload)

# Global MCP Server instance
mcp_server = MCPServer()

# Register default processors
async def sanitize_response(response: Dict[str, Any]) -> Dict[str, Any]:
    """Default post-processor: sanitize and format response"""
    if 'response' in response:
        # Basic sanitization
        response['response'] = response['response'].strip()
    return response

mcp_server.register_post_processor('sanitize', sanitize_response)
