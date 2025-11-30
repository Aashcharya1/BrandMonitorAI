"""
DNS Monitoring Router - Agentless DNS Monitoring
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import subprocess
import json
import socket
import uuid
try:
    import dns.resolver
    import dns.query
    import dns.zone
    DNS_PYTHON_AVAILABLE = True
except ImportError:
    DNS_PYTHON_AVAILABLE = False
    logger.warning("dnspython not installed. DNS monitoring will use fallback methods.")
import os
import logging
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()

# Store active monitoring sessions
monitoring_sessions: Dict[str, Dict[str, Any]] = {}

class DNSMonitorRequest(BaseModel):
    domain: str
    record_types: List[str] = ["A", "AAAA", "MX", "TXT", "NS"]
    interval: str = "hourly"  # realtime, hourly, daily, weekly
    nameservers: Optional[List[str]] = None
    alert_threshold: int = 5  # percentage
    check_timeout: int = 30  # seconds
    enable_change_detection: bool = True

class DNSRecordResponse(BaseModel):
    record_type: str
    records: List[Dict[str, Any]]
    timestamp: str

@router.post("/dns/monitor")
async def start_dns_monitoring(request: DNSMonitorRequest, background_tasks: BackgroundTasks):
    """Start DNS monitoring for a domain"""
    try:
        if not request.domain or not request.domain.strip():
            raise HTTPException(status_code=400, detail="Domain is required")
        
        if not request.record_types:
            raise HTTPException(status_code=400, detail="At least one record type must be selected")
        
        domain = request.domain.strip().lower()
        session_id = f"dns-{domain}-{uuid.uuid4()}"
        
        # Perform initial DNS query
        initial_records = {}
        if DNS_PYTHON_AVAILABLE:
            try:
                for record_type in request.record_types:
                    try:
                        if request.nameservers:
                            resolver = dns.resolver.Resolver()
                            resolver.nameservers = request.nameservers
                            answers = resolver.resolve(domain, record_type)
                        else:
                            answers = dns.resolver.resolve(domain, record_type)
                        
                        initial_records[record_type] = [
                            {
                                "value": str(rdata),
                                "ttl": answers.rrset.ttl if hasattr(answers.rrset, 'ttl') else None
                            }
                            for rdata in answers
                        ]
                    except Exception as e:
                        logger.warning(f"Could not resolve {record_type} for {domain}: {e}")
                        initial_records[record_type] = []
            except Exception as e:
                logger.error(f"DNS resolution error: {e}")
        else:
            # Fallback if dnspython not installed
            logger.warning("dnspython not installed, using fallback DNS resolution")
            try:
                # Basic A record lookup
                if "A" in request.record_types:
                    ip = socket.gethostbyname(domain)
                    initial_records["A"] = [{"value": ip, "ttl": None}]
            except Exception as e:
                logger.error(f"DNS resolution failed: {e}")
                initial_records = {}
        
        # Store monitoring session
        monitoring_sessions[session_id] = {
            "domain": domain,
            "record_types": request.record_types,
            "interval": request.interval,
            "nameservers": request.nameservers,
            "alert_threshold": request.alert_threshold,
            "check_timeout": request.check_timeout,
            "enable_change_detection": request.enable_change_detection,
            "baseline": initial_records,
            "started_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        return {
            "session_id": session_id,
            "domain": domain,
            "status": "monitoring",
            "baseline_records": initial_records,
            "message": "DNS monitoring started"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting DNS monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dns/monitor/stop")
async def stop_dns_monitoring(domain: str):
    """Stop DNS monitoring for a domain"""
    try:
        # Find and remove monitoring session
        sessions_to_remove = [
            sid for sid, session in monitoring_sessions.items()
            if session["domain"] == domain.lower()
        ]
        
        for sid in sessions_to_remove:
            monitoring_sessions[sid]["status"] = "stopped"
            del monitoring_sessions[sid]
        
        return {
            "domain": domain,
            "status": "stopped",
            "message": f"DNS monitoring stopped for {domain}"
        }
    except Exception as e:
        logger.error(f"Error stopping DNS monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dns/monitor/status/{domain}")
async def get_dns_monitoring_status(domain: str):
    """Get DNS monitoring status and current records"""
    try:
        # Find active session
        session = None
        for sid, sess in monitoring_sessions.items():
            if sess["domain"] == domain.lower() and sess["status"] == "active":
                session = sess
                break
        
        if not session:
            return {
                "domain": domain,
                "status": "not_monitoring",
                "message": "No active monitoring session found"
            }
        
        # Get current DNS records
        current_records = {}
        if DNS_PYTHON_AVAILABLE:
            try:
                for record_type in session["record_types"]:
                    try:
                        if session["nameservers"]:
                            resolver = dns.resolver.Resolver()
                            resolver.nameservers = session["nameservers"]
                            answers = resolver.resolve(domain, record_type)
                        else:
                            answers = dns.resolver.resolve(domain, record_type)
                        
                        current_records[record_type] = [
                            {
                                "value": str(rdata),
                                "ttl": answers.rrset.ttl if hasattr(answers.rrset, 'ttl') else None
                            }
                            for rdata in answers
                        ]
                    except Exception as e:
                        logger.warning(f"Could not resolve {record_type} for {domain}: {e}")
                        current_records[record_type] = []
            except Exception as e:
                logger.error(f"DNS resolution error: {e}")
        else:
            # Fallback DNS resolution
            try:
                if "A" in session["record_types"]:
                    ip = socket.gethostbyname(domain)
                    current_records["A"] = [{"value": ip, "ttl": None}]
            except:
                pass
        
        # Detect changes if enabled
        changes = []
        if session["enable_change_detection"]:
            baseline = session.get("baseline", {})
            for record_type in session["record_types"]:
                baseline_values = {r["value"] for r in baseline.get(record_type, [])}
                current_values = {r["value"] for r in current_records.get(record_type, [])}
                
                if baseline_values != current_values:
                    added = current_values - baseline_values
                    removed = baseline_values - current_values
                    if added or removed:
                        changes.append({
                            "record_type": record_type,
                            "added": list(added),
                            "removed": list(removed),
                            "timestamp": datetime.now().isoformat()
                        })
        
        return {
            "domain": domain,
            "status": "monitoring",
            "current_records": current_records,
            "baseline_records": session.get("baseline", {}),
            "changes": changes,
            "started_at": session["started_at"],
            "interval": session["interval"]
        }
    except Exception as e:
        logger.error(f"Error getting DNS monitoring status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dns/query/{domain}")
async def query_dns(domain: str, record_type: str = "A"):
    """Query DNS records for a domain"""
    try:
        if not domain or not domain.strip():
            raise HTTPException(status_code=400, detail="Domain is required")
        
        domain = domain.strip().lower()
        
        if DNS_PYTHON_AVAILABLE:
            try:
                answers = dns.resolver.resolve(domain, record_type)
                records = [
                    {
                        "value": str(rdata),
                        "ttl": answers.rrset.ttl if hasattr(answers.rrset, 'ttl') else None
                    }
                    for rdata in answers
                ]
                
                return {
                    "domain": domain,
                    "record_type": record_type,
                    "records": records,
                    "timestamp": datetime.now().isoformat()
                }
            except dns.resolver.NXDOMAIN:
                raise HTTPException(status_code=404, detail=f"Domain {domain} not found")
            except dns.resolver.NoAnswer:
                return {
                    "domain": domain,
                    "record_type": record_type,
                    "records": [],
                    "timestamp": datetime.now().isoformat(),
                    "message": f"No {record_type} records found for {domain}"
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"DNS query failed: {str(e)}")
        else:
            # Fallback DNS resolution
            if record_type == "A":
                try:
                    ip = socket.gethostbyname(domain)
                    return {
                        "domain": domain,
                        "record_type": record_type,
                        "records": [{"value": ip, "ttl": None}],
                        "timestamp": datetime.now().isoformat(),
                        "note": "Using fallback DNS resolution (install dnspython for full support)"
                    }
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"DNS resolution failed: {str(e)}")
            else:
                raise HTTPException(status_code=400, detail=f"Record type {record_type} requires dnspython library. Install with: pip install dnspython")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying DNS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

