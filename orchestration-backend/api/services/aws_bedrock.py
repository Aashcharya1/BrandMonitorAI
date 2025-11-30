"""
AWS Bedrock Integration
For text generation using AWS Bedrock foundation models
"""

import os
import json
import logging
import boto3
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class AWSBedrockClient:
    """Client for AWS Bedrock API"""
    
    def __init__(self):
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        self.access_key = os.getenv('AWS_ACCESS_KEY_ID')
        self.secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.enabled = os.getenv('AWS_BEDROCK_ENABLED', 'false').lower() == 'true'
        
        if self.enabled and self.access_key and self.secret_key:
            try:
                self.bedrock_runtime = boto3.client(
                    'bedrock-runtime',
                    region_name=self.region,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key
                )
                logger.info("AWS Bedrock client initialized")
            except Exception as e:
                logger.error(f"AWS Bedrock initialization failed: {e}")
                self.bedrock_runtime = None
        else:
            logger.warning("AWS Bedrock not enabled or credentials missing")
            self.bedrock_runtime = None
    
    async def generate_text(self, prompt: str, model_id: str = "anthropic.claude-v2", 
                          max_tokens: int = 4096, temperature: float = 0.7) -> Dict[str, Any]:
        """Generate text using AWS Bedrock"""
        if not self.bedrock_runtime:
            raise ValueError("AWS Bedrock not configured")
        
        try:
            # Format request body for Claude
            body = {
                "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
                "max_tokens_to_sample": max_tokens,
                "temperature": temperature
            }
            
            response = self.bedrock_runtime.invoke_model(
                modelId=model_id,
                body=json.dumps(body)
            )
            
            response_body = json.loads(response['body'].read())
            return {
                "response": response_body.get('completion', ''),
                "provider": "aws-bedrock",
                "model": model_id
            }
        except ClientError as e:
            logger.error(f"AWS Bedrock API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Text generation failed: {e}")
            raise

# Global bedrock client instance
bedrock_client = AWSBedrockClient()

