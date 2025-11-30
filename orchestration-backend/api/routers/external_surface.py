"""
External Surface Monitoring Router - SpiderFoot Integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import subprocess
import json
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class SpiderFootScanRequest(BaseModel):
    target: str
    scan_type: str = "all"  # all, passive, active, custom
    modules: List[str] = []
    scan_depth: int = 3
    timeout: int = 3600
    output_format: str = "json"
    max_threads: int = 10

@router.post("/external-surface/scan")
async def start_spiderfoot_scan(request: SpiderFootScanRequest):
    """Start a SpiderFoot external surface scan"""
    try:
        # Validate target
        if not request.target or not request.target.strip():
            raise HTTPException(status_code=400, detail="Target domain is required")
        
        target = request.target.strip().lower()
        
        # Determine which modules to use
        if request.scan_type == "custom" and request.modules:
            modules = request.modules
        elif request.scan_type == "passive":
            modules = ["sfp_dnsresolve", "sfp_dnsbrute", "sfp_subdomain", "sfp_whois", "sfp_webanalyze"]
        elif request.scan_type == "active":
            modules = ["sfp_portscan", "sfp_ssl", "sfp_certificate"]
        else:  # all
            modules = ["sfp_dnsresolve", "sfp_dnsbrute", "sfp_subdomain", "sfp_whois", "sfp_webanalyze", 
                      "sfp_portscan", "sfp_ssl", "sfp_certificate"]
        
        # Create scan job
        job_id = f"spiderfoot-{uuid.uuid4()}"
        
        # For now, return a queued job
        # In production, this would queue a Celery task that runs SpiderFoot
        return {
            "job_id": job_id,
            "status": "queued",
            "target": target,
            "scan_type": request.scan_type,
            "modules": modules,
            "message": "SpiderFoot scan queued. Integration in progress."
        }
    except Exception as e:
        logger.error(f"Error starting SpiderFoot scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/external-surface/status/{job_id}")
async def get_spiderfoot_status(job_id: str):
    """Get SpiderFoot scan status"""
    try:
        # In production, this would check Celery task status
        # For now, return a mock response
        return {
            "job_id": job_id,
            "status": "finished",
            "result": {
                "entities_found": 0,
                "data_points": 0,
                "modules_run": 0
            }
        }
    except Exception as e:
        logger.error(f"Error getting SpiderFoot status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

