"""
Takedown Monitoring Router
API endpoints for phishing detection, brand monitoring, and automated takedown management.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Request/Response Models ====================

class BrandConfigRequest(BaseModel):
    """Request to configure brand monitoring"""
    brand_name: str
    domains: List[str]
    keywords: List[str]
    logos: Optional[List[str]] = []
    social_handles: Optional[Dict[str, str]] = {}


class DomainCheckRequest(BaseModel):
    """Request to check a domain for threats"""
    domain: str


class BulkDomainScanRequest(BaseModel):
    """Request to scan multiple domains"""
    domains: List[str]


class SocialMediaCheckRequest(BaseModel):
    """Request to check social media for fake profiles"""
    brand_name: str
    platforms: Optional[List[str]] = None


class NewDomainSearchRequest(BaseModel):
    """Request to search for newly registered suspicious domains"""
    brand_name: str
    days_back: int = 7


class TakedownRequestModel(BaseModel):
    """Request to generate a takedown request"""
    threat_id: str
    request_type: str = "abuse_report"  # abuse_report, dmca, trademark, phishing
    additional_info: Optional[Dict[str, Any]] = None


class GenerateReportRequest(BaseModel):
    """Request to generate abuse/DMCA report"""
    threat_id: str
    report_type: str = "abuse"  # abuse, dmca
    company_info: Optional[Dict[str, str]] = None


class CTMonitorRequest(BaseModel):
    """Request to start Certificate Transparency monitoring"""
    duration_seconds: int = 60
    brands: Optional[List[str]] = None


# ==================== Helper Functions ====================

def get_takedown_monitor():
    """Lazy import of TakedownMonitor to avoid circular imports"""
    try:
        from services.takedown_monitor import takedown_monitor
        return takedown_monitor
    except ImportError as e:
        logger.error(f"Failed to import TakedownMonitor: {e}")
        raise HTTPException(status_code=500, detail="Takedown monitoring service not available")


# In-memory storage for threats (in production, use database)
_threats_db: Dict[str, Any] = {}
_takedown_requests_db: Dict[str, Any] = {}


# ==================== Brand Configuration ====================

@router.post("/takedown/brands/configure")
async def configure_brand_monitoring(request: BrandConfigRequest):
    """
    Configure a brand for monitoring.
    Sets up typosquatting patterns, keyword monitoring, and social media tracking.
    """
    try:
        from services.takedown_monitor import BrandConfig
        
        monitor = get_takedown_monitor()
        
        config = BrandConfig(
            brand_name=request.brand_name,
            domains=request.domains,
            keywords=request.keywords,
            logos=request.logos or [],
            social_handles=request.social_handles or {}
        )
        
        monitor.add_brand_config(config)
        
        return {
            "status": "configured",
            "brand_name": request.brand_name,
            "domains": request.domains,
            "keywords": request.keywords,
            "typosquat_patterns_generated": len(config.typosquat_patterns),
            "message": f"Brand '{request.brand_name}' configured for monitoring"
        }
        
    except Exception as e:
        logger.error(f"Error configuring brand: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/takedown/brands")
async def get_configured_brands():
    """Get list of configured brands for monitoring"""
    try:
        monitor = get_takedown_monitor()
        
        brands = []
        for name, config in monitor.brand_configs.items():
            brands.append({
                "brand_name": config.brand_name,
                "domains": config.domains,
                "keywords": config.keywords,
                "social_handles": config.social_handles,
                "typosquat_patterns_count": len(config.typosquat_patterns)
            })
        
        return {
            "total_brands": len(brands),
            "brands": brands
        }
        
    except Exception as e:
        logger.error(f"Error getting brands: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Domain Threat Detection ====================

@router.post("/takedown/check-domain")
async def check_domain_threat(request: DomainCheckRequest):
    """
    Check if a domain is a potential phishing/typosquatting threat.
    Analyzes against configured brands and general phishing indicators.
    """
    try:
        monitor = get_takedown_monitor()
        
        threat = await monitor.check_domain_threat(request.domain)
        
        if threat:
            # Store in memory DB
            _threats_db[threat.id] = threat
            
            return {
                "is_threat": True,
                "threat": {
                    "id": threat.id,
                    "threat_type": threat.threat_type,
                    "platform": threat.platform,
                    "target": threat.target,
                    "brand_affected": threat.brand_affected,
                    "similarity_score": threat.similarity_score,
                    "risk_level": threat.risk_level,
                    "status": threat.status,
                    "evidence": threat.evidence,
                    "detected_at": threat.detected_at
                }
            }
        
        return {
            "is_threat": False,
            "domain": request.domain,
            "message": "No threat indicators detected"
        }
        
    except Exception as e:
        logger.error(f"Error checking domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/takedown/scan-domains")
async def scan_multiple_domains(request: BulkDomainScanRequest):
    """
    Scan multiple domains for threats.
    Useful for batch processing suspected domains.
    """
    try:
        monitor = get_takedown_monitor()
        
        threats = await monitor.scan_suspicious_domains(request.domains)
        
        # Store threats
        for threat in threats:
            _threats_db[threat.id] = threat
        
        return {
            "total_scanned": len(request.domains),
            "threats_found": len(threats),
            "threats": [
                {
                    "id": t.id,
                    "threat_type": t.threat_type,
                    "target": t.target,
                    "brand_affected": t.brand_affected,
                    "risk_level": t.risk_level,
                    "similarity_score": t.similarity_score
                }
                for t in threats
            ],
            "scanned_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error scanning domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/takedown/search-new-domains")
async def search_new_suspicious_domains(request: NewDomainSearchRequest):
    """
    Search for newly registered domains that might be impersonating a brand.
    Requires domain intelligence API integration.
    """
    try:
        monitor = get_takedown_monitor()
        
        if request.brand_name.lower() not in monitor.brand_configs:
            raise HTTPException(
                status_code=400, 
                detail=f"Brand '{request.brand_name}' not configured. Please configure it first."
            )
        
        threats = await monitor.search_new_domains(request.brand_name, request.days_back)
        
        # Store threats
        for threat in threats:
            _threats_db[threat.id] = threat
        
        return {
            "brand": request.brand_name,
            "days_searched": request.days_back,
            "threats_found": len(threats),
            "threats": [
                {
                    "id": t.id,
                    "threat_type": t.threat_type,
                    "target": t.target,
                    "risk_level": t.risk_level,
                    "similarity_score": t.similarity_score,
                    "detected_at": t.detected_at
                }
                for t in threats
            ],
            "searched_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching new domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Social Media Monitoring ====================

@router.post("/takedown/check-social-media")
async def check_social_media_threats(request: SocialMediaCheckRequest):
    """
    Check social media platforms for fake profiles impersonating a brand.
    Uses Sherlock and other tools for username enumeration.
    """
    try:
        monitor = get_takedown_monitor()
        
        if request.brand_name.lower() not in monitor.brand_configs:
            raise HTTPException(
                status_code=400,
                detail=f"Brand '{request.brand_name}' not configured. Please configure it first."
            )
        
        threats = await monitor.check_social_media_threats(
            request.brand_name,
            request.platforms
        )
        
        # Store threats
        for threat in threats:
            _threats_db[threat.id] = threat
        
        return {
            "brand": request.brand_name,
            "platforms_checked": request.platforms or ['twitter', 'instagram', 'facebook', 'linkedin', 'telegram'],
            "threats_found": len(threats),
            "threats": [
                {
                    "id": t.id,
                    "threat_type": t.threat_type,
                    "platform": t.platform,
                    "target": t.target,
                    "risk_level": t.risk_level,
                    "evidence": t.evidence,
                    "detected_at": t.detected_at
                }
                for t in threats
            ],
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking social media: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Certificate Transparency Monitoring ====================

@router.post("/takedown/monitor-certificates")
async def start_certificate_monitoring(request: CTMonitorRequest, background_tasks: BackgroundTasks):
    """
    Start monitoring Certificate Transparency logs for suspicious domains.
    Runs in background and detects new certificates for typosquat domains.
    """
    try:
        monitor = get_takedown_monitor()
        
        # Start monitoring in background
        job_id = str(uuid.uuid4())[:8]
        
        async def monitor_task():
            threats = await monitor.monitor_certificate_transparency(
                duration_seconds=request.duration_seconds
            )
            for threat in threats:
                _threats_db[threat.id] = threat
        
        background_tasks.add_task(monitor_task)
        
        return {
            "job_id": job_id,
            "status": "started",
            "duration_seconds": request.duration_seconds,
            "message": "Certificate Transparency monitoring started. Check threats endpoint for results."
        }
        
    except Exception as e:
        logger.error(f"Error starting CT monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Takedown Management ====================

@router.get("/takedown/threats")
async def get_detected_threats(
    status: Optional[str] = None,
    threat_type: Optional[str] = None,
    platform: Optional[str] = None,
    risk_level: Optional[str] = None,
    limit: int = 100
):
    """
    Get list of detected threats.
    Supports filtering by status, type, platform, and risk level.
    """
    try:
        threats = list(_threats_db.values())
        
        # Apply filters
        if status:
            threats = [t for t in threats if t.status == status]
        if threat_type:
            threats = [t for t in threats if t.threat_type == threat_type]
        if platform:
            threats = [t for t in threats if t.platform == platform]
        if risk_level:
            threats = [t for t in threats if t.risk_level == risk_level]
        
        # Sort by detected_at (most recent first)
        threats.sort(key=lambda x: x.detected_at, reverse=True)
        
        return {
            "total": len(threats),
            "threats": [
                {
                    "id": t.id,
                    "threat_type": t.threat_type,
                    "platform": t.platform,
                    "target": t.target,
                    "brand_affected": t.brand_affected,
                    "similarity_score": t.similarity_score,
                    "risk_level": t.risk_level,
                    "status": t.status,
                    "detected_at": t.detected_at
                }
                for t in threats[:limit]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting threats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/takedown/threats/{threat_id}")
async def get_threat_details(threat_id: str):
    """Get detailed information about a specific threat"""
    try:
        threat = _threats_db.get(threat_id)
        
        if not threat:
            raise HTTPException(status_code=404, detail="Threat not found")
        
        return {
            "id": threat.id,
            "threat_type": threat.threat_type,
            "platform": threat.platform,
            "target": threat.target,
            "brand_affected": threat.brand_affected,
            "similarity_score": threat.similarity_score,
            "risk_level": threat.risk_level,
            "status": threat.status,
            "evidence": threat.evidence,
            "detected_at": threat.detected_at,
            "updated_at": threat.updated_at,
            "takedown_info": threat.takedown_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting threat details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/takedown/threats/{threat_id}/status")
async def update_threat_status(threat_id: str, status: str):
    """Update the status of a threat"""
    try:
        from services.takedown_monitor import TakedownStatus
        
        threat = _threats_db.get(threat_id)
        
        if not threat:
            raise HTTPException(status_code=404, detail="Threat not found")
        
        # Validate status
        valid_statuses = [s.value for s in TakedownStatus]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {valid_statuses}"
            )
        
        threat.status = status
        threat.updated_at = datetime.utcnow().isoformat()
        
        return {
            "id": threat.id,
            "status": threat.status,
            "updated_at": threat.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating threat status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Report Generation ====================

@router.post("/takedown/generate-report")
async def generate_takedown_report(request: GenerateReportRequest):
    """
    Generate abuse report or DMCA notice for a threat.
    Returns formatted text ready for submission.
    """
    try:
        monitor = get_takedown_monitor()
        
        threat = _threats_db.get(request.threat_id)
        
        if not threat:
            raise HTTPException(status_code=404, detail="Threat not found")
        
        if request.report_type == "abuse":
            report = monitor.generate_abuse_report(threat)
        elif request.report_type == "dmca":
            company_info = request.company_info or {
                'company_name': '[YOUR COMPANY NAME]',
                'contact_name': '[YOUR NAME]',
                'contact_email': '[YOUR EMAIL]',
                'contact_address': '[YOUR ADDRESS]'
            }
            report = monitor.generate_dmca_notice(threat, company_info)
        else:
            raise HTTPException(status_code=400, detail="Invalid report type. Use 'abuse' or 'dmca'")
        
        # Get takedown contacts
        contact_info = monitor._get_takedown_contact(threat)
        
        return {
            "threat_id": threat.id,
            "report_type": request.report_type,
            "report_content": report,
            "contact_info": contact_info,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/takedown/create-request")
async def create_takedown_request(request: TakedownRequestModel):
    """
    Create a takedown request for a detected threat.
    Generates necessary documentation and tracks the request.
    """
    try:
        monitor = get_takedown_monitor()
        
        threat = _threats_db.get(request.threat_id)
        
        if not threat:
            raise HTTPException(status_code=404, detail="Threat not found")
        
        takedown_request = monitor.generate_takedown_request(
            threat,
            request.request_type,
            request.additional_info
        )
        
        # Store takedown request
        _takedown_requests_db[takedown_request.id] = takedown_request
        
        # Update threat with takedown info
        threat.takedown_info = {
            'request_id': takedown_request.id,
            'request_type': takedown_request.request_type,
            'created_at': datetime.utcnow().isoformat()
        }
        threat.status = 'takedown_requested'
        threat.updated_at = datetime.utcnow().isoformat()
        
        return {
            "request_id": takedown_request.id,
            "threat_id": threat.id,
            "request_type": takedown_request.request_type,
            "platform": takedown_request.platform,
            "target": takedown_request.target,
            "contact_info": takedown_request.contact_info,
            "status": takedown_request.status,
            "created_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating takedown request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/takedown/requests")
async def get_takedown_requests(status: Optional[str] = None, limit: int = 100):
    """Get list of takedown requests"""
    try:
        requests = list(_takedown_requests_db.values())
        
        if status:
            requests = [r for r in requests if r.status == status]
        
        return {
            "total": len(requests),
            "requests": [
                {
                    "id": r.id,
                    "threat_id": r.threat_id,
                    "platform": r.platform,
                    "target": r.target,
                    "request_type": r.request_type,
                    "status": r.status,
                    "submitted_at": r.submitted_at,
                    "response_at": r.response_at
                }
                for r in requests[:limit]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting takedown requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Dashboard & Summary ====================

@router.get("/takedown/summary")
async def get_takedown_summary():
    """
    Get summary dashboard data for takedown monitoring.
    """
    try:
        threats = list(_threats_db.values())
        requests = list(_takedown_requests_db.values())
        
        # Count by status
        status_counts = {}
        for threat in threats:
            status_counts[threat.status] = status_counts.get(threat.status, 0) + 1
        
        # Count by type
        type_counts = {}
        for threat in threats:
            type_counts[threat.threat_type] = type_counts.get(threat.threat_type, 0) + 1
        
        # Count by risk level
        risk_counts = {}
        for threat in threats:
            risk_counts[threat.risk_level] = risk_counts.get(threat.risk_level, 0) + 1
        
        # Calculate takedown success rate
        completed = len([r for r in requests if r.status == 'takedown_completed'])
        total_requests = len(requests)
        success_rate = (completed / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "total_threats": len(threats),
            "total_takedown_requests": len(requests),
            "by_status": status_counts,
            "by_type": type_counts,
            "by_risk_level": risk_counts,
            "takedown_success_rate": round(success_rate, 2),
            "recent_threats": [
                {
                    "id": t.id,
                    "threat_type": t.threat_type,
                    "target": t.target,
                    "risk_level": t.risk_level,
                    "detected_at": t.detected_at
                }
                for t in sorted(threats, key=lambda x: x.detected_at, reverse=True)[:5]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/takedown/contacts")
async def get_takedown_contacts():
    """Get list of known takedown contacts for various platforms"""
    try:
        monitor = get_takedown_monitor()
        return {
            "contacts": monitor.takedown_contacts
        }
    except Exception as e:
        logger.error(f"Error getting contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

