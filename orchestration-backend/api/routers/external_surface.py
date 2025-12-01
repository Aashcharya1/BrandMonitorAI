"""
External Surface Monitoring Router - SpiderFoot Integration
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import subprocess
import json
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Import Celery task (lazy import to avoid circular dependencies)
def get_celery_imports():
    """Lazy import of Celery components"""
    try:
        from celery.result import AsyncResult
        from celery_app import celery_app
        # Import task function dynamically
        import importlib
        import sys
        import os as os_module
        # Get the parent directory (api folder)
        parent_dir = os_module.path.dirname(os_module.path.dirname(__file__))
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        tasks_module = importlib.import_module('tasks')
        spiderfoot_scan = getattr(tasks_module, 'spiderfoot_scan')
        return AsyncResult, celery_app, spiderfoot_scan
    except ImportError as e:
        logger.error(f"Failed to import Celery components: {e}")
        raise

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
        # Comprehensive passive discovery modules for better subdomain enumeration
        passive_discovery_modules = [
            "sfp_crt",              # Certificate Transparency (CRT.sh) - CRITICAL for subdomain discovery
            "sfp_subdomain",        # General subdomain enumeration
            "sfp_dnsbrute",         # DNS brute forcing
            "sfp_dnsresolve",       # DNS resolution
            "sfp_whois",            # WHOIS lookups
            "sfp_hackertarget",     # HackerTarget API
            "sfp_threatcrowd",      # ThreatCrowd API
            "sfp_virustotal",       # VirusTotal API (requires key)
            "sfp_shodan",           # Shodan API (requires key)
            "sfp_securitytrails",   # SecurityTrails API (requires key)
            "sfp_censys",           # Censys API (requires key)
            "sfp_webanalyze",       # Web analysis
            "sfp_ssl",              # SSL certificate analysis
            "sfp_certificate",      # Certificate parsing
            "sfp_dnscommonsrv",     # DNS common SRV records
            "sfp_dnsdb",            # DNS database lookups
        ]
        
        active_modules = [
            "sfp_portscan",         # Port scanning
            "sfp_ssl",              # SSL analysis
            "sfp_certificate",      # Certificate analysis
            "sfp_webanalyze",       # Web analysis
        ]
        
        if request.scan_type == "custom" and request.modules:
            modules = request.modules
        elif request.scan_type == "passive":
            modules = passive_discovery_modules
        elif request.scan_type == "active":
            modules = active_modules
        else:  # all
            modules = passive_discovery_modules + active_modules
        
        # Create scan job
        scan_id = f"spiderfoot-{uuid.uuid4()}"
        
        # Queue Celery task for SpiderFoot scan
        try:
            AsyncResult, celery_app, spiderfoot_scan = get_celery_imports()
            async_result = spiderfoot_scan.delay(
                scan_id,
                target,
                request.scan_type,
                modules,
                request.scan_depth,
                request.timeout,
                request.max_threads,
                request.output_format
            )
            
            return {
                "job_id": async_result.id,
                "scan_id": scan_id,
                "status": "queued",
                "target": target,
                "scan_type": request.scan_type,
                "modules": modules,
                "message": "SpiderFoot scan queued successfully"
            }
        except Exception as e:
            logger.error(f"Failed to queue SpiderFoot scan: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to queue scan: {str(e)}")
    except Exception as e:
        logger.error(f"Error starting SpiderFoot scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/external-surface/status/{job_id}")
async def get_spiderfoot_status(job_id: str):
    """Get SpiderFoot scan status"""
    try:
        AsyncResult, celery_app, _ = get_celery_imports()
        async_result = AsyncResult(job_id, app=celery_app)
        
        # Check if result backend is disabled
        backend = celery_app.backend
        if backend is None or (hasattr(backend, 'as_uri') and backend.as_uri() == 'disabled://'):
            raise HTTPException(
                status_code=503,
                detail="Celery result backend is not configured. Please configure CELERY_RESULT_BACKEND in your .env file."
            )
        
        # Get task state
        try:
            state = async_result.state
        except Exception as backend_error:
            error_str = str(backend_error).lower()
            if 'connection' in error_str or 'redis' in error_str or 'disabled' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail="Cannot connect to Celery result backend. Please ensure Redis is running."
                )
            raise HTTPException(status_code=500, detail=f"Failed to retrieve task status: {str(backend_error)}")
        
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
        
        # Get target from task result if available
        target = None
        try:
            if async_result.state == 'SUCCESS':
                result = async_result.result
                if result:
                    target = result.get('target')
        except:
            pass
        
        response = {
            "job_id": job_id,
            "status": status,
            "target": target
        }
        
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
        
        # Add result when complete
        if state == 'SUCCESS':
            try:
                result = async_result.result
                if result:
                    response["result"] = {
                        "entities_found": len(result.get('entities', [])),
                        "data_points": result.get('data_points', 0),
                        "modules_run": result.get('modules_run', 0),
                        "entities": result.get('entities', [])[:100]  # Limit to first 100 entities
                    }
                    if result.get('csv_filename'):
                        response["result"]["csv_filename"] = result.get('csv_filename')
                        response["result"]["csv_download_url"] = f"/api/v1/external-surface/download/{result.get('csv_filename')}"
                    # Only include error in response if it's a real failure (no entities found)
                    # Don't set error if scan succeeded with results
                    if result.get('error') and (not result.get('entities') or len(result.get('entities', [])) == 0):
                        response["error"] = result.get('error')
                    elif result.get('error'):
                        # Log warning but don't show as error if we have results
                        logger.warning(f"Scan completed with warning: {result.get('error')}")
                        response["warning"] = result.get('error')
            except Exception as e:
                logger.warning(f"Could not retrieve result: {e}")
                response["result"] = None
        
        # Check for pending tasks (no worker running)
        if state == 'PENDING':
            try:
                task_info = async_result.info
                if task_info is None:
                    inspect = celery_app.control.inspect()
                    active_workers = inspect.active() if inspect else None
                    if not active_workers:
                        response["warning"] = "No Celery workers are running. Please start a worker with: celery -A celery_app worker --loglevel=info --pool=solo"
            except Exception:
                pass
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting scan status for {job_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scan status: {str(e)}"
        )

@router.get("/external-surface/download/{filename}")
async def download_scan_csv(filename: str):
    """Download CSV export of scan results"""
    try:
        # Security: Only allow CSV files
        if not filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        # Security: Prevent directory traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Get exports directory (api/exports)
        api_dir = os.path.dirname(__file__)
        # Go up one level from routers/ to api/
        api_dir = os.path.dirname(api_dir)
        exports_dir = os.path.join(api_dir, 'exports')
        file_path = os.path.join(exports_dir, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return file
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='text/csv',
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading CSV file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@router.get("/external-surface/export-csv/{job_id}")
async def export_csv_on_demand(job_id: str):
    """Generate CSV export on-demand from scan results"""
    try:
        AsyncResult, celery_app, _ = get_celery_imports()
        async_result = AsyncResult(job_id, app=celery_app)
        
        if async_result.state != 'SUCCESS':
            raise HTTPException(status_code=400, detail="Scan not completed yet")
        
        result = async_result.result
        if not result or not result.get('entities'):
            raise HTTPException(status_code=404, detail="No entities found to export")
        
        # Generate CSV
        import csv
        from datetime import datetime
        
        api_dir = os.path.dirname(__file__)
        api_dir = os.path.dirname(api_dir)
        exports_dir = os.path.join(api_dir, 'exports')
        os.makedirs(exports_dir, exist_ok=True)
        
        target = result.get('target', 'unknown')
        scan_id = result.get('scan_id', job_id)
        csv_filename = f"spiderfoot_{scan_id}_{target.replace('.', '_')}.csv"
        csv_file_path = os.path.join(exports_dir, csv_filename)
        
        with open(csv_file_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['type', 'value', 'module', 'scan_id', 'target', 'timestamp']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for entity in result.get('entities', []):
                writer.writerow({
                    'type': entity.get('type', ''),
                    'value': entity.get('value', ''),
                    'module': entity.get('module', ''),
                    'scan_id': scan_id,
                    'target': target,
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
        logger.error(f"Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")

@router.get("/external-surface/export-json/{job_id}")
async def export_json_on_demand(job_id: str):
    """Generate JSON export on-demand from scan results"""
    try:
        AsyncResult, celery_app, _ = get_celery_imports()
        async_result = AsyncResult(job_id, app=celery_app)
        
        if async_result.state != 'SUCCESS':
            raise HTTPException(status_code=400, detail="Scan not completed yet")
        
        result = async_result.result
        if not result:
            raise HTTPException(status_code=404, detail="No scan results found to export")
        
        # Generate JSON export with full scan data
        from datetime import datetime
        import json
        
        api_dir = os.path.dirname(__file__)
        api_dir = os.path.dirname(api_dir)
        exports_dir = os.path.join(api_dir, 'exports')
        os.makedirs(exports_dir, exist_ok=True)
        
        target = result.get('target', 'unknown')
        scan_id = result.get('scan_id', job_id)
        json_filename = f"spiderfoot_{scan_id}_{target.replace('.', '_')}.json"
        json_file_path = os.path.join(exports_dir, json_filename)
        
        # Create comprehensive JSON export
        export_data = {
            'scan_id': scan_id,
            'target': target,
            'scan_timestamp': datetime.utcnow().isoformat(),
            'summary': {
                'entities_found': len(result.get('entities', [])),
                'data_points': result.get('data_points', 0),
                'modules_run': result.get('modules_run', 0)
            },
            'entities': result.get('entities', []),
            'full_result': result  # Include all result data
        }
        
        with open(json_file_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(export_data, jsonfile, indent=2, ensure_ascii=False)
        
        # Return the file
        return FileResponse(
            path=json_file_path,
            filename=json_filename,
            media_type='application/json',
            headers={"Content-Disposition": f'attachment; filename="{json_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting JSON: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export JSON: {str(e)}")

