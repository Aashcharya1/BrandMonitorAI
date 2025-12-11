"""
Data Leak Monitoring Router
API endpoints for database leakage monitoring, credential exposure detection, and alerts.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr, HttpUrl
from typing import Optional, List, Dict, Any
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Request/Response Models ====================

class EmailBreachCheckRequest(BaseModel):
    """Request to check an email for breaches"""
    email: EmailStr
    include_unverified: bool = False
    include_pastes: bool = True


class DomainBreachCheckRequest(BaseModel):
    """Request to check a domain for breaches"""
    domain: str


class PasswordCheckRequest(BaseModel):
    """Request to check if a password has been compromised"""
    password: str


class ExposedDatabaseScanRequest(BaseModel):
    """Request to scan for exposed databases (LeakLooker style)"""
    domain: Optional[str] = None
    org: Optional[str] = None
    db_types: Optional[List[str]] = None  # mongodb, elasticsearch, redis, etc.
    limit: int = 100


class RepositorySecretScanRequest(BaseModel):
    """Request to scan a repository for leaked secrets"""
    repo_url: str  # Git repository URL
    branch: Optional[str] = None
    since_commit: Optional[str] = None
    max_depth: Optional[int] = None


class ComprehensiveScanRequest(BaseModel):
    """Request for comprehensive leak scanning"""
    domain: Optional[str] = None
    emails: Optional[List[EmailStr]] = None
    org: Optional[str] = None
    repo_urls: Optional[List[str]] = None
    include_db_scan: bool = True
    include_secret_scan: bool = True


class BreachSearchRequest(BaseModel):
    """Request to search local breach database"""
    search_term: str
    search_type: str = "email"  # email, username, domain
    max_results: int = 100


class LeakAlertConfig(BaseModel):
    """Configuration for leak monitoring alerts"""
    enabled: bool = True
    domains: List[str] = []
    emails: List[EmailStr] = []
    organizations: List[str] = []
    repo_urls: List[str] = []
    scan_interval_hours: int = 24
    alert_on_new_breach: bool = True
    alert_on_exposed_db: bool = True
    alert_on_leaked_secret: bool = True
    webhook_url: Optional[str] = None
    email_recipients: Optional[List[EmailStr]] = None


# ==================== Helper Functions ====================

def get_data_leak_monitor():
    """Lazy import of DataLeakMonitor to avoid circular imports"""
    try:
        from services.data_leak_monitor import data_leak_monitor
        return data_leak_monitor
    except ImportError as e:
        logger.error(f"Failed to import DataLeakMonitor: {e}")
        raise HTTPException(status_code=500, detail="Data leak monitoring service not available")


def get_celery_imports():
    """Lazy import of Celery components"""
    try:
        from celery.result import AsyncResult
        from celery_app import celery_app
        import importlib
        import sys
        import os
        parent_dir = os.path.dirname(os.path.dirname(__file__))
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        tasks_module = importlib.import_module('tasks')
        return AsyncResult, celery_app, tasks_module
    except ImportError as e:
        logger.error(f"Failed to import Celery components: {e}")
        raise HTTPException(status_code=500, detail="Task queue not available")


# ==================== Email/Domain Breach Endpoints ====================

@router.post("/data-leaks/check-email")
async def check_email_breaches(request: EmailBreachCheckRequest):
    """
    Check if an email has been involved in known data breaches.
    Uses HaveIBeenPwned API.
    
    Requires HIBP_API_KEY environment variable.
    """
    try:
        monitor = get_data_leak_monitor()
        
        # Check breaches
        breaches = await monitor.check_email_breaches(
            request.email,
            include_unverified=request.include_unverified
        )
        
        # Check pastes if requested
        pastes = []
        if request.include_pastes:
            pastes = await monitor.get_pastes_for_email(request.email)
        
        # Calculate risk score
        risk_score = 0
        if breaches:
            risk_score += min(len(breaches) * 10, 50)  # Up to 50 points for breaches
            # Add points for sensitive breaches
            for breach in breaches:
                if breach.is_sensitive:
                    risk_score += 20
                if 'Passwords' in breach.data_classes:
                    risk_score += 15
                if breach.is_verified:
                    risk_score += 5
        
        if pastes:
            risk_score += min(len(pastes) * 5, 30)  # Up to 30 points for pastes
        
        risk_score = min(risk_score, 100)  # Cap at 100
        
        return {
            "email": request.email,
            "breach_count": len(breaches),
            "paste_count": len(pastes),
            "risk_score": risk_score,
            "risk_level": "critical" if risk_score >= 80 else "high" if risk_score >= 50 else "medium" if risk_score >= 25 else "low",
            "breaches": [
                {
                    "name": b.name,
                    "title": b.title,
                    "domain": b.domain,
                    "breach_date": b.breach_date,
                    "pwn_count": b.pwn_count,
                    "data_classes": b.data_classes,
                    "is_verified": b.is_verified,
                    "is_sensitive": b.is_sensitive,
                    "description": b.description[:500] if b.description else ""
                }
                for b in breaches
            ],
            "pastes": pastes,
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error checking email breaches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-leaks/check-domain")
async def check_domain_breaches(request: DomainBreachCheckRequest):
    """
    Check breaches associated with a domain.
    Uses HaveIBeenPwned API.
    """
    try:
        monitor = get_data_leak_monitor()
        breaches = await monitor.check_domain_breaches(request.domain)
        
        total_records = sum(b.pwn_count for b in breaches)
        
        return {
            "domain": request.domain,
            "breach_count": len(breaches),
            "total_records_exposed": total_records,
            "breaches": [
                {
                    "name": b.name,
                    "title": b.title,
                    "breach_date": b.breach_date,
                    "pwn_count": b.pwn_count,
                    "data_classes": b.data_classes,
                    "is_verified": b.is_verified
                }
                for b in breaches
            ],
            "checked_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error checking domain breaches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-leaks/check-password")
async def check_password_compromised(request: PasswordCheckRequest):
    """
    Check if a password has been exposed in data breaches.
    Uses k-Anonymity - only first 5 chars of SHA-1 hash are sent.
    This is SAFE to use - the full password is never transmitted.
    
    No API key required.
    """
    try:
        monitor = get_data_leak_monitor()
        result = await monitor.check_password_pwned(request.password)
        
        # Add recommendation
        if result.get('pwned'):
            result['recommendation'] = "This password has been exposed in data breaches. You should change it immediately on all accounts where it's used."
        else:
            result['recommendation'] = "This password has not been found in known breaches. However, still follow password best practices."
        
        return result
        
    except Exception as e:
        logger.error(f"Error checking password: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-leaks/breaches")
async def get_all_known_breaches(
    limit: int = 100,
    verified_only: bool = False
):
    """
    Get list of all known breaches in the HIBP database.
    Useful for threat intelligence and awareness.
    """
    try:
        monitor = get_data_leak_monitor()
        breaches = await monitor.get_all_breaches()
        
        if verified_only:
            breaches = [b for b in breaches if b.is_verified]
        
        # Sort by date (most recent first)
        breaches.sort(key=lambda x: x.breach_date or '', reverse=True)
        
        return {
            "total_breaches": len(breaches),
            "breaches": [
                {
                    "name": b.name,
                    "title": b.title,
                    "domain": b.domain,
                    "breach_date": b.breach_date,
                    "pwn_count": b.pwn_count,
                    "data_classes": b.data_classes,
                    "is_verified": b.is_verified,
                    "is_sensitive": b.is_sensitive
                }
                for b in breaches[:limit]
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting breaches: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Exposed Database Scanning (LeakLooker) ====================

@router.post("/data-leaks/scan-databases")
async def scan_exposed_databases(request: ExposedDatabaseScanRequest, background_tasks: BackgroundTasks):
    """
    Scan for exposed databases using Shodan (LeakLooker style).
    This is AGENTLESS - queries Shodan's database of internet scans.
    
    Supports: MongoDB, Elasticsearch, Redis, CouchDB, Cassandra, Jenkins, GitLab, etc.
    
    Requires SHODAN_API_KEY environment variable.
    """
    try:
        if not request.domain and not request.org:
            raise HTTPException(status_code=400, detail="Either domain or org is required")
        
        # Queue as background task for large scans
        scan_id = f"db-scan-{uuid.uuid4()}"
        
        try:
            AsyncResult, celery_app, tasks_module = get_celery_imports()
            # Check if task exists
            if hasattr(tasks_module, 'scan_exposed_databases_task'):
                async_result = tasks_module.scan_exposed_databases_task.delay(
                    scan_id,
                    request.domain,
                    request.org,
                    request.db_types,
                    request.limit
                )
                
                return {
                    "job_id": async_result.id,
                    "scan_id": scan_id,
                    "status": "queued",
                    "message": "Exposed database scan queued. Check status endpoint for results."
                }
        except Exception as e:
            logger.warning(f"Celery not available, running synchronously: {e}")
        
        # Fallback: Run synchronously if Celery not available
        monitor = get_data_leak_monitor()
        
        # Convert string db_types to enum if provided
        db_type_enums = None
        if request.db_types:
            from services.data_leak_monitor import DatabaseType
            db_type_enums = []
            for dt in request.db_types:
                try:
                    db_type_enums.append(DatabaseType(dt.lower()))
                except ValueError:
                    logger.warning(f"Unknown database type: {dt}")
        
        results = await monitor.scan_exposed_databases(
            domain=request.domain,
            org=request.org,
            db_types=db_type_enums,
            limit=request.limit
        )
        
        # Group by severity
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for r in results:
            severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1
        
        return {
            "scan_id": scan_id,
            "status": "completed",
            "target": request.domain or request.org,
            "total_findings": len(results),
            "severity_summary": severity_counts,
            "findings": [
                {
                    "type": r.leak_type,
                    "title": r.title,
                    "description": r.description,
                    "severity": r.severity,
                    "ip": r.data.get('ip'),
                    "port": r.data.get('port'),
                    "database_type": r.data.get('database_type'),
                    "hostnames": r.data.get('hostnames', []),
                    "org": r.data.get('org'),
                    "country": r.data.get('country'),
                    "vulnerabilities": r.data.get('vulns', [])
                }
                for r in results
            ],
            "scanned_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scanning for exposed databases: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-leaks/scan-services")
async def scan_exposed_services(domain: str = None, ip: str = None):
    """
    Scan a specific domain/IP for exposed services using Shodan.
    Returns detailed information about open ports and services.
    """
    try:
        if not domain and not ip:
            raise HTTPException(status_code=400, detail="Either domain or ip is required")
        
        monitor = get_data_leak_monitor()
        results = await monitor.scan_exposed_services(domain=domain, ip=ip)
        
        return {
            "target": domain or ip,
            "total_findings": len(results),
            "findings": [
                {
                    "type": r.leak_type,
                    "title": r.title,
                    "severity": r.severity,
                    "ip": r.data.get('ip'),
                    "port": r.data.get('port'),
                    "service": r.data.get('service'),
                    "product": r.data.get('product'),
                    "version": r.data.get('version'),
                    "vulnerabilities": r.data.get('vulns', [])
                }
                for r in results
            ],
            "scanned_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scanning services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Repository Secret Scanning (TruffleHog) ====================

@router.post("/data-leaks/scan-repository")
async def scan_repository_secrets(request: RepositorySecretScanRequest):
    """
    Scan a git repository for leaked secrets using TruffleHog3.
    This is AGENTLESS - scans the repo directly via URL.
    
    Supports: GitHub, GitLab, Bitbucket, and any git URL.
    
    Detects: AWS keys, API tokens, passwords, private keys, etc.
    
    Requires TruffleHog3 to be installed (pip install trufflehog3).
    """
    try:
        scan_id = f"repo-scan-{uuid.uuid4()}"
        
        # Run synchronously for immediate results (TruffleHog3 is fast enough)
        monitor = get_data_leak_monitor()
        results = await monitor.scan_repository_secrets(
            repo_url=request.repo_url,
            branch=request.branch,
            since_commit=request.since_commit,
            max_depth=request.max_depth
        )
        
        # Group by severity
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for r in results:
            severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1
        
        # Group by detector type
        by_detector = {}
        for r in results:
            detector = r.data.get('detector', 'unknown')
            if detector not in by_detector:
                by_detector[detector] = 0
            by_detector[detector] += 1
        
        return {
            "scan_id": scan_id,
            "status": "completed",
            "repository": request.repo_url,
            "total_findings": len(results),
            "severity_summary": severity_counts,
            "detector_summary": by_detector,
            "findings": [
                {
                    "type": r.leak_type,
                    "title": r.title,
                    "severity": r.severity,
                    "detector": r.data.get('detector'),
                    "verified": r.data.get('verified', False),
                    "redacted": r.data.get('redacted'),
                    "file": r.data.get('source_metadata', {}).get('Data', {}).get('Git', {}).get('file', ''),
                    "commit": r.data.get('source_metadata', {}).get('Data', {}).get('Git', {}).get('commit', '')
                }
                for r in results
            ],
            "scanned_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scanning repository: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Breach Database Search ====================

@router.post("/data-leaks/search-breaches")
async def search_breach_database(request: BreachSearchRequest):
    """
    Search local breach database files (Breach-Parse style).
    
    Requires BREACH_DB_DIR environment variable pointing to breach data files.
    """
    try:
        monitor = get_data_leak_monitor()
        results = await monitor.search_breach_database(
            search_term=request.search_term,
            search_type=request.search_type,
            max_results=request.max_results
        )
        
        return {
            "search_term": request.search_term,
            "search_type": request.search_type,
            "results_count": len(results),
            "results": results,
            "searched_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error searching breach database: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Comprehensive Scanning ====================

@router.post("/data-leaks/comprehensive-scan")
async def run_comprehensive_scan(request: ComprehensiveScanRequest):
    """
    Run a comprehensive data leak scan combining all methods:
    - Email breach checking (HIBP)
    - Domain breach checking (HIBP)
    - Exposed database scanning (Shodan/LeakLooker)
    - Repository secret scanning (TruffleHog)
    
    This is the recommended endpoint for thorough leak monitoring.
    """
    try:
        scan_id = f"comprehensive-{uuid.uuid4()}"
        
        # Try to queue as background task (recommended for large scans)
        try:
            AsyncResult, celery_app, tasks_module = get_celery_imports()
            if hasattr(tasks_module, 'comprehensive_leak_scan_task'):
                async_result = tasks_module.comprehensive_leak_scan_task.delay(
                    scan_id,
                    request.domain,
                    request.emails or [],
                    request.org,
                    request.repo_urls or [],
                    request.include_db_scan,
                    request.include_secret_scan
                )
                
                return {
                    "job_id": async_result.id,
                    "scan_id": scan_id,
                    "status": "queued",
                    "message": "Comprehensive leak scan queued. This may take several minutes depending on scope."
                }
        except Exception as e:
            logger.warning(f"Celery not available, running synchronously: {e}")
        
        # Fallback: Run synchronously
        monitor = get_data_leak_monitor()
        results = await monitor.comprehensive_leak_scan(
            domain=request.domain,
            emails=request.emails,
            org=request.org,
            repo_urls=request.repo_urls,
            include_db_scan=request.include_db_scan,
            include_secret_scan=request.include_secret_scan
        )
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running comprehensive scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-leaks/scan-status/{job_id}")
async def get_scan_status(job_id: str):
    """
    Get the status of a background leak scan.
    """
    try:
        AsyncResult, celery_app, _ = get_celery_imports()
        async_result = AsyncResult(job_id, app=celery_app)
        
        status_map = {
            'PENDING': 'queued',
            'STARTED': 'running',
            'PROGRESS': 'running',
            'SUCCESS': 'completed',
            'FAILURE': 'failed',
            'REVOKED': 'cancelled'
        }
        
        status = status_map.get(async_result.state, async_result.state.lower())
        
        response = {
            "job_id": job_id,
            "status": status
        }
        
        if async_result.state == 'SUCCESS':
            response["result"] = async_result.result
        elif async_result.state == 'FAILURE':
            response["error"] = str(async_result.info) if async_result.info else "Unknown error"
        elif async_result.state == 'PROGRESS':
            response["progress"] = async_result.info
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scan status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Alert Configuration ====================

@router.post("/data-leaks/alerts/configure")
async def configure_leak_alerts(config: LeakAlertConfig):
    """
    Configure automated leak monitoring and alerts.
    
    Set up continuous monitoring for:
    - New breaches affecting your domains/emails
    - Exposed databases in your infrastructure
    - Leaked secrets in your repositories
    """
    try:
        # Store configuration (in production, this would go to database)
        from database.mongodb import get_mongodb_db
        db = get_mongodb_db()
        
        if db:
            # Upsert alert configuration
            await db.leak_alert_configs.update_one(
                {"_id": "default"},
                {"$set": {
                    "enabled": config.enabled,
                    "domains": config.domains,
                    "emails": config.emails,
                    "organizations": config.organizations,
                    "repo_urls": config.repo_urls,
                    "scan_interval_hours": config.scan_interval_hours,
                    "alert_on_new_breach": config.alert_on_new_breach,
                    "alert_on_exposed_db": config.alert_on_exposed_db,
                    "alert_on_leaked_secret": config.alert_on_leaked_secret,
                    "webhook_url": config.webhook_url,
                    "email_recipients": config.email_recipients,
                    "updated_at": datetime.utcnow().isoformat()
                }},
                upsert=True
            )
            
            return {
                "status": "configured",
                "message": "Leak monitoring alerts configured successfully",
                "config": config.dict()
            }
        else:
            # MongoDB not available, return config without persistence
            return {
                "status": "configured",
                "message": "Alert configuration accepted (note: MongoDB not available for persistence)",
                "config": config.dict()
            }
        
    except Exception as e:
        logger.error(f"Error configuring alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-leaks/alerts/config")
async def get_alert_config():
    """
    Get current leak monitoring alert configuration.
    """
    try:
        from database.mongodb import get_mongodb_db
        db = get_mongodb_db()
        
        if db:
            config = await db.leak_alert_configs.find_one({"_id": "default"})
            if config:
                config.pop('_id', None)
                return config
        
        # Return default config if none exists
        return {
            "enabled": False,
            "domains": [],
            "emails": [],
            "organizations": [],
            "repo_urls": [],
            "scan_interval_hours": 24,
            "message": "No alert configuration found"
        }
        
    except Exception as e:
        logger.error(f"Error getting alert config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-leaks/alerts/history")
async def get_alert_history(
    limit: int = 50,
    severity: str = None
):
    """
    Get history of leak alerts.
    """
    try:
        from database.mongodb import get_mongodb_db
        db = get_mongodb_db()
        
        if db:
            query = {}
            if severity:
                query["severity"] = severity
            
            cursor = db.leak_alerts.find(query).sort("created_at", -1).limit(limit)
            alerts = await cursor.to_list(length=limit)
            
            for alert in alerts:
                alert['_id'] = str(alert['_id'])
            
            return {
                "total": len(alerts),
                "alerts": alerts
            }
        
        return {
            "total": 0,
            "alerts": [],
            "message": "MongoDB not available"
        }
        
    except Exception as e:
        logger.error(f"Error getting alert history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Dashboard Summary ====================

@router.get("/data-leaks/summary")
async def get_leak_monitoring_summary():
    """
    Get summary dashboard data for leak monitoring.
    """
    try:
        from database.mongodb import get_mongodb_db
        db = get_mongodb_db()
        
        summary = {
            "status": "operational",
            "services": {
                "hibp": "configured" if get_data_leak_monitor().hibp_api_key else "not_configured",
                "shodan": "configured" if get_data_leak_monitor().shodan_api_key else "not_configured",
                "trufflehog": "available",  # We'll check this separately
                "breach_db": "configured" if get_data_leak_monitor().breach_db_dir else "not_configured"
            },
            "recent_scans": [],
            "alerts_today": 0,
            "total_findings_this_week": 0
        }
        
        if db:
            # Get recent scans
            recent_scans = await db.leak_scans.find().sort("started_at", -1).limit(5).to_list(length=5)
            summary["recent_scans"] = [
                {
                    "scan_id": s.get("scan_id"),
                    "type": s.get("scan_type"),
                    "target": s.get("target"),
                    "status": s.get("status"),
                    "findings_count": s.get("findings_count", 0),
                    "started_at": s.get("started_at")
                }
                for s in recent_scans
            ]
            
            # Count today's alerts
            from datetime import datetime, timedelta
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            summary["alerts_today"] = await db.leak_alerts.count_documents({
                "created_at": {"$gte": today_start.isoformat()}
            })
            
            # Count this week's findings
            week_start = today_start - timedelta(days=7)
            summary["total_findings_this_week"] = await db.leak_findings.count_documents({
                "discovered_at": {"$gte": week_start.isoformat()}
            })
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

