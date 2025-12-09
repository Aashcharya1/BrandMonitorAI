"""
Monitoring Router - Active & Passive Scanning
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
try:
    from celery_app import celery_app
    from tasks import orchestrate_scan
except ImportError:
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from celery_app import celery_app
    from tasks import orchestrate_scan
import os

router = APIRouter()

class ScanRequest(BaseModel):
    target: str
    enable_passive: bool = True
    enable_active: bool = True
    enable_vuln: bool = False
    nessus_policy_uuid: Optional[str] = None
    port_range: Optional[str] = None
    scan_intensity: str = "normal"
    max_threads: int = 10
    timeout: int = 3600

@router.post("/monitor/start")
async def start_scan(request: ScanRequest):
    """Start a new security scan"""
    import re
    from urllib.parse import urlparse
    
    # Clean up the target: strip protocol, path, port, etc.
    target = request.target.strip()
    
    # Remove protocol if present (http://, https://, etc.)
    if target.startswith(('http://', 'https://')):
        parsed = urlparse(target)
        target = parsed.netloc or parsed.path
    elif '://' in target:
        # Handle other protocols
        target = target.split('://', 1)[1]
    
    # Remove path, query, and fragment
    if '/' in target:
        target = target.split('/')[0]
    if '?' in target:
        target = target.split('?')[0]
    if '#' in target:
        target = target.split('#')[0]
    
    # Remove port if present
    if ':' in target:
        target = target.split(':')[0]
    
    # Validate domain format: must be a valid domain name
    DOMAIN_REGEX = re.compile(r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$')
    
    if not target or not DOMAIN_REGEX.match(target):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid domain format. Expected format: 'example.com' (without protocol). You entered: '{request.target}'"
        )
    
    if not request.enable_passive and not request.enable_active and not request.enable_vuln:
        raise HTTPException(status_code=400, detail="At least one scan type must be enabled")
    
    scan_id = f"scan-{uuid.uuid4()}"
    
    # Queue Celery task (use cleaned target)
    async_result = orchestrate_scan.delay(
        scan_id,
        target,  # Use cleaned target
        request.nessus_policy_uuid,
        request.enable_passive,
        request.enable_active,
        request.enable_vuln,
        request.port_range,
        request.scan_intensity,
        request.max_threads,
        request.timeout
    )
    
    return {
        "job_id": async_result.id,
        "scan_id": scan_id,
        "status": "queued",
        "target": target  # Return cleaned target
    }

@router.get("/monitor/status/{job_id}")
async def get_scan_status(job_id: str):
    """Get scan job status"""
    from celery.result import AsyncResult
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        async_result = AsyncResult(job_id, app=celery_app)
        
        # Check if result backend is disabled
        backend = celery_app.backend
        if backend is None:
            raise HTTPException(
                status_code=503,
                detail="Celery result backend is not configured. Please configure CELERY_RESULT_BACKEND in your .env file (e.g., CELERY_RESULT_BACKEND=redis://localhost:6379/0) and ensure Redis is running."
            )
        # Check if it's a DisabledBackend by checking the class name or method availability
        if hasattr(backend, 'as_uri'):
            backend_uri = backend.as_uri()
            if backend_uri == 'disabled://':
                raise HTTPException(
                    status_code=503,
                    detail="Celery result backend is disabled. Please configure CELERY_RESULT_BACKEND in your .env file (e.g., CELERY_RESULT_BACKEND=redis://localhost:6379/0) and ensure Redis is running."
                )
        
        # Check if result backend is available
        try:
            # Try to get state - this will fail if result backend is not accessible
            state = async_result.state
        except AttributeError as attr_error:
            # Check if it's the DisabledBackend error
            if '_get_task_meta_for' in str(attr_error) or 'DisabledBackend' in str(attr_error):
                raise HTTPException(
                    status_code=503,
                    detail="Celery result backend is disabled. Please configure CELERY_RESULT_BACKEND in your .env file (e.g., CELERY_RESULT_BACKEND=redis://localhost:6379/0) and ensure Redis is running."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to retrieve task status: {str(attr_error)}"
                )
        except Exception as backend_error:
            logger.error(f"Result backend error for job {job_id}: {backend_error}")
            # Check if this is a connection error
            error_str = str(backend_error).lower()
            if 'connection' in error_str or 'redis' in error_str or 'broker' in error_str or 'disabled' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail=f"Cannot connect to Celery result backend. Please ensure Redis is running and CELERY_RESULT_BACKEND is configured correctly in your .env file."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to retrieve task status: {str(backend_error)}"
                )
        
        # Initialize response dictionary early
        response = {
            "job_id": job_id,
            "status": "unknown"
        }
        
        # Map Celery states to frontend-friendly states
        status_map = {
            'PENDING': 'queued',
            'STARTED': 'running',
            'SUCCESS': 'finished',
            'FAILURE': 'failed',
            'REVOKED': 'canceled',
            'RETRY': 'running'
        }
        status = status_map.get(state, state.lower())
        response["status"] = status
        
        # If state is PENDING for a long time, it likely means no worker is running
        if state == 'PENDING':
            # Check how long the task has been pending
            try:
                # Try to get task info to see if it exists
                task_info = async_result.info
                if task_info is None:
                    # Task exists but no worker has picked it up
                    # Check if there are any active workers
                    inspect = celery_app.control.inspect()
                    active_workers = inspect.active() if inspect else None
                    if not active_workers:
                        # No workers detected
                        response["warning"] = "No Celery workers are running. Please start a worker with: celery -A celery_app worker --loglevel=info"
            except AttributeError:
                # DisabledBackend or similar - already handled above
                pass
            except Exception as e:
                logger.warning(f"Could not check task readiness: {e}")
        
        # Add error information if task failed
        if state == 'FAILURE':
            try:
                error_info = async_result.info
                if isinstance(error_info, Exception):
                    response["error"] = str(error_info)
                elif isinstance(error_info, dict):
                    response["error"] = error_info.get("error", str(error_info))
                else:
                    response["error"] = str(error_info) if error_info else "Scan task failed"
            except Exception as e:
                logger.warning(f"Could not retrieve error info: {e}")
                response["error"] = "Scan task failed with unknown error"
        
        # Add result URL when complete
        if state == 'SUCCESS':
            kibana_base = os.getenv('KIBANA_URL', '')
            kibana_dashboard = os.getenv('KIBANA_DASHBOARD_URL', '')
            result_url = kibana_dashboard or (f"{kibana_base}/app/kibana#/dashboard" if kibana_base else None)
            response["result_url"] = result_url
            try:
                result = async_result.result
                if result is not None:
                    response["result"] = result
                    logger.info(f"Successfully retrieved result for job {job_id}: {len(str(result))} bytes")
                else:
                    logger.warning(f"Result is None for job {job_id}")
                    response["result"] = None
            except Exception as e:
                logger.error(f"Could not retrieve result for job {job_id}: {e}", exc_info=True)
                # If result retrieval fails, log but don't fail the status check
                response["result"] = None
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting scan status for {job_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scan status: {str(e)}"
        )

@router.get("/monitor/export-csv/{job_id}")
async def export_monitoring_csv(job_id: str):
    """Generate CSV export on-demand from monitoring scan results"""
    from celery.result import AsyncResult
    import csv
    from datetime import datetime
    
    try:
        async_result = AsyncResult(job_id, app=celery_app)
        
        if async_result.state != 'SUCCESS':
            raise HTTPException(status_code=400, detail="Scan not completed yet")
        
        result = async_result.result
        if not result:
            raise HTTPException(status_code=404, detail="No scan results found to export")
        
        # Generate CSV
        api_dir = os.path.dirname(__file__)
        api_dir = os.path.dirname(api_dir)
        exports_dir = os.path.join(api_dir, 'exports')
        os.makedirs(exports_dir, exist_ok=True)
        
        domain = result.get('domain', 'unknown')
        scan_id = result.get('scan_id', job_id)
        csv_filename = f"monitoring_scan_{scan_id}_{domain.replace('.', '_')}.csv"
        csv_file_path = os.path.join(exports_dir, csv_filename)
        
        with open(csv_file_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['scan_id', 'domain', 'hostname', 'ip', 'port', 'port_status', 'service_name', 'service_version', 'protocol', 'subdomain', 'vulnerability_name', 'vulnerability_severity', 'vulnerability_cve', 'timestamp']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write subdomains
            subdomains = result.get('subdomains', [])
            host_to_ip = result.get('host_to_ip', {})
            for subdomain in subdomains:
                writer.writerow({
                    'scan_id': scan_id,
                    'domain': domain,
                    'hostname': subdomain,
                    'ip': host_to_ip.get(subdomain, ''),
                    'port': '',
                    'port_status': '',
                    'service_name': '',
                    'service_version': '',
                    'protocol': '',
                    'subdomain': subdomain,
                    'vulnerability_name': '',
                    'vulnerability_severity': '',
                    'vulnerability_cve': '',
                    'timestamp': datetime.utcnow().isoformat()
                })
            
            # Write services (all ports in services list are confirmed open)
            services = result.get('services', [])
            for service in services:
                writer.writerow({
                    'scan_id': scan_id,
                    'domain': domain,
                    'hostname': service.get('hostname', ''),
                    'ip': service.get('ip', ''),
                    'port': service.get('port', ''),
                    'port_status': 'open',  # All ports in services list are confirmed open
                    'service_name': service.get('name', ''),
                    'service_version': service.get('version', ''),
                    'protocol': service.get('protocol', 'tcp'),
                    'subdomain': service.get('hostname', ''),
                    'vulnerability_name': '',
                    'vulnerability_severity': '',
                    'vulnerability_cve': '',
                    'timestamp': datetime.utcnow().isoformat()
                })
            
            # Write vulnerabilities
            vulnerabilities = result.get('vulnerabilities', [])
            for vuln in vulnerabilities:
                writer.writerow({
                    'scan_id': scan_id,
                    'domain': domain,
                    'hostname': vuln.get('host', ''),
                    'ip': '',
                    'port': vuln.get('port', ''),
                    'port_status': 'open',  # Vulnerabilities are only found on open ports
                    'service_name': '',
                    'service_version': '',
                    'protocol': vuln.get('protocol', ''),
                    'subdomain': vuln.get('host', ''),
                    'vulnerability_name': vuln.get('name', ''),
                    'vulnerability_severity': vuln.get('severity', ''),
                    'vulnerability_cve': vuln.get('cve', ''),
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        # Return the file
        return FileResponse(
            path=csv_file_path,
            filename=csv_filename,
            media_type='text/csv',
            headers={"Content-Disposition": f'attachment; filename="{csv_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting monitoring CSV: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")

@router.get("/monitor/search")
async def search_assets(q: str = ""):
    """Search assets using Meilisearch"""
    from meilisearch import Client as MeiliClient
    
    if not q.strip():
        return {"results": []}
    
    meili_url = os.getenv('MEILI_URL')
    meili_key = os.getenv('MEILI_KEY')
    meili_index = os.getenv('MEILI_INDEX', 'assets_search')
    
    if not meili_url or not meili_key:
        raise HTTPException(status_code=503, detail="Meilisearch not configured")
    
    try:
        meili = MeiliClient(meili_url, meili_key)
        results = meili.index(meili_index).search(q, {'limit': 20})
        return {"results": results.get('hits', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

