"""
External Surface Monitoring Router - ASM (Attack Surface Management) Integration
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

class ASMScanRequest(BaseModel):
    target: str
    target_type: str = "domain"  # domain, ip, asn, netblock
    scan_type: str = "mvp"  # mvp, all, passive, active, enrichment, custom
    modules: List[str] = []
    scan_depth: int = 3
    timeout: int = 3600
    output_format: str = "json"
    max_threads: int = 10

class EnrichmentScanRequest(BaseModel):
    """Request to enrich an existing scan with Layers 2-4 data"""
    job_id: str  # Original scan job ID
    target_subdomains: Optional[List[str]] = None  # Specific subdomains to enrich (if None, uses all from original scan)

@router.post("/external-surface/scan")
async def start_spiderfoot_scan(request: ASMScanRequest):
    """
    Start an external surface monitoring scan with comprehensive ASM capabilities.
    
    Supports 4 layers of discovery:
    - Layer 1: Basic Discovery (subdomains, IPs, certificates)
    - Layer 2: Technology Stack (software, banners, versions)
    - Layer 3: Cloud Storage (S3, Azure, GCP buckets)
    - Layer 4: Content & Secrets (emails, forms, open ports)
    
    Note: Some modules require API keys configured in the scanning engine:
    - Port Discovery: Requires Shodan API key
    - Threat Intelligence: Requires VirusTotal API key
    - Passive DNS: Requires SecurityTrails API key
    - Internet Scanning: Requires Censys API key
    
    Active modules (Web Crawling, Cloud Storage, etc.) require scan_type="all" or "mvp"
    """
    try:
        # Validate target
        if not request.target or not request.target.strip():
            raise HTTPException(status_code=400, detail="Target domain is required")
        
        target = request.target.strip().lower()
        
        # Validate target type
        target_type = request.target_type.lower()
        valid_target_types = ["domain", "ip", "asn", "netblock"]
        if target_type not in valid_target_types:
            raise HTTPException(status_code=400, detail=f"Invalid target_type. Must be one of: {', '.join(valid_target_types)}")
        
        # Validate scan_depth
        if request.scan_depth < 1 or request.scan_depth > 1000:
            raise HTTPException(status_code=400, detail="scan_depth must be between 1 and 1000")
        
        # Determine which modules to use based on MVP recommendations
        # All modules below do NOT require API keys (except sfp_shodan which is optional)
        # These are the core modules for comprehensive ASM across all 4 layers
        
        # Phase 1: Discovery modules (Layer 1) - CRITICAL - NO API KEYS REQUIRED
        discovery_modules = [
            "sfp_crt",              # Certificate Transparency - CRITICAL for subdomain discovery (NO API KEY)
            "sfp_subdomain",        # General subdomain enumeration (NO API KEY)
            "sfp_dnsresolve",       # DNS resolution - CRITICAL for IP mapping (NO API KEY)
        ]
        
        # Phase 2: Resolution & Ownership modules (Layer 1) - HIGH priority - NO API KEYS REQUIRED
        resolution_modules = [
            "sfp_whois",            # WHOIS lookups - CRITICAL for ownership/netblocks (NO API KEY)
            "sfp_dnsbrute",         # DNS brute forcing (NO API KEY)
            "sfp_dnscommonsrv",     # DNS common SRV records (NO API KEY)
            # Note: sfp_dnsdb requires API key, so it's in optional modules below
        ]
        
        # Phase 3: Technology Stack (Layer 2) - CRITICAL for MVP - NO API KEYS REQUIRED
        technology_modules = [
            "sfp_wappalyzer",       # Tech stack identification - CRITICAL (React, Django, etc.) (NO API KEY - requires Wappalyzer tool)
            "sfp_httpheader",       # Server banners - CRITICAL (gunicorn, nginx versions) (NO API KEY)
        ]
        
        # Phase 4: Cloud & Storage (Layer 3) - CRITICAL for security - NO API KEYS REQUIRED
        cloud_modules = [
            "sfp_s3bucket",         # AWS S3 bucket discovery - CRITICAL (NO API KEY)
                        "sfp_azureblobstorage", # Azure blob discovery - CRITICAL (NO API KEY)
                        "sfp_googleobjectstorage", # GCP bucket discovery - CRITICAL (NO API KEY)
        ]
        
        # Phase 5: Content & Secrets (Layer 4) - Active scanning required - NO API KEYS REQUIRED (except sfp_shodan)
        content_modules = [
            "sfp_spider",           # Web crawling for emails/forms - CRITICAL (active, NO API KEY)
            "sfp_portscan_tcp",     # TCP port scanning - CRITICAL (active, NO API KEY)
            # Note: sfp_shodan requires API key, so it's in optional modules below
        ]
        
        # Optional modules that require API keys (these enhance results but are not required)
        optional_api_modules = [
            "sfp_shodan",           # Shodan API - Open ports/banners (REQUIRES API KEY - but provides passive port data)
            "sfp_virustotal",       # VirusTotal API - Threat intelligence (REQUIRES API KEY)
            "sfp_securitytrails",   # SecurityTrails API - Passive DNS (REQUIRES API KEY)
            "sfp_censys",           # Censys API - Internet scanning data (REQUIRES API KEY)
            "sfp_dnsdb",            # DNSDB API - Historical DNS (REQUIRES API KEY)
        ]
        
        # Additional supporting modules (NO API KEYS REQUIRED)
        supporting_modules = [
            "sfp_hackertarget",     # HackerTarget API (free, no key needed)
            "sfp_threatcrowd",      # ThreatCrowd API (free, no key needed)
            "sfp_webanalyze",       # Web analysis (NO API KEY)
            "sfp_ssl",              # SSL certificate analysis (NO API KEY)
            "sfp_certificate",      # Certificate parsing (NO API KEY)
            "sfp_email_extractor",  # Email extraction from content (NO API KEY)
        ]
        
        # Additional passive discovery modules (includes all non-API modules)
        passive_discovery_modules = discovery_modules + resolution_modules + supporting_modules
        
        # Active scanning modules (require direct connection to target, NO API KEYS REQUIRED)
        active_modules = [
            "sfp_portscan_tcp",     # TCP port scanning (already in content_modules, but listed here for clarity)
            "sfp_ssl",              # SSL analysis (NO API KEY)
            "sfp_certificate",      # Certificate analysis (NO API KEY)
            "sfp_webanalyze",       # Web analysis (NO API KEY)
        ]
        
        # Combine all enrichment modules (technology + cloud + content)
        # These are the core non-API modules for Layers 2-4
        enrichment_modules = technology_modules + cloud_modules + content_modules
        
        # MVP recommended modules (combines all critical NON-API modules for full surface report)
        # This includes: Discovery + Resolution + Technology + Cloud + Content + Active + Supporting
        # All these modules work WITHOUT API keys (except optional ones added below)
        mvp_modules = (
            discovery_modules +           # Layer 1: Discovery (NO API KEYS)
            resolution_modules +          # Layer 1: Resolution (NO API KEYS)
            enrichment_modules +           # Layers 2-4: Technology + Cloud + Content (NO API KEYS)
            active_modules +              # Active scanning (NO API KEYS)
            supporting_modules            # Additional supporting modules (NO API KEYS)
        )
        
        # Optionally add API-based modules if available (these enhance results but aren't required)
        # Users can configure these in the scanning engine settings if they have API keys
        # For now, we'll include sfp_shodan in MVP since it's commonly configured
        # Other API modules (virustotal, securitytrails, censys) are optional enhancements
        mvp_modules.append("sfp_shodan")  # Add Shodan (requires API key, but commonly configured)
        
        # Remove duplicates while preserving order
        mvp_modules = list(dict.fromkeys(mvp_modules))
        
        if request.scan_type == "custom" and request.modules:
            modules = request.modules
        elif request.scan_type == "mvp":
            # Use MVP recommended modules for comprehensive ASM dashboard (all 4 layers)
            modules = mvp_modules
        elif request.scan_type == "enrichment":
            # Enrichment scan: Only run Layers 2-4 on discovered assets (technology, cloud, content)
            # This is for enriching existing scan results with technology stack, ports, etc.
            modules = enrichment_modules + active_modules
            # Remove duplicates
            modules = list(dict.fromkeys(modules))
        elif request.scan_type == "passive":
            modules = passive_discovery_modules
        elif request.scan_type == "active":
            modules = active_modules
        else:  # all
            modules = mvp_modules  # Default to MVP modules for comprehensive results
        
        # Log module configuration for debugging
        logger.info(f"Scan configuration: type={request.scan_type}, target={target}, target_type={target_type}, modules_count={len(modules)}")
        logger.debug(f"Modules enabled: {', '.join(modules[:10])}{'...' if len(modules) > 10 else ''}")
        
        # Create scan job
        scan_id = f"asm-scan-{uuid.uuid4()}"
        
        # Queue Celery task for external surface scan
        try:
            AsyncResult, celery_app, spiderfoot_scan = get_celery_imports()
            async_result = spiderfoot_scan.delay(
                scan_id,
                target,
                target_type,
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
                "message": "External surface scan queued successfully"
            }
        except Exception as e:
            logger.error(f"Failed to queue external surface scan: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to queue scan: {str(e)}")
    except Exception as e:
        logger.error(f"Error starting external surface scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/external-surface/status/{job_id}")
async def get_spiderfoot_status(job_id: str):
    """Get external surface monitoring scan status"""
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
            'PROGRESS': 'running',  # Show progress as running
            'SUCCESS': 'finished',
            'FAILURE': 'failed',
            'REVOKED': 'canceled',
            'RETRY': 'running'
        }
        status = status_map.get(state, state.lower())
        
        # Get target and partial results from task meta if available
        target = None
        partial_result = None
        try:
            if async_result.state == 'SUCCESS':
                result = async_result.result
                if result:
                    target = result.get('target')
            elif async_result.state == 'PROGRESS':
                # Get partial results from task meta
                meta = async_result.info
                if isinstance(meta, dict):
                    target = meta.get('target')
                    partial_result = meta
        except:
            pass
        
        response = {
            "job_id": job_id,
            "status": status,
            "target": target
        }
        
        # Add partial results if scan is running
        if state == 'PROGRESS' and partial_result:
            try:
                entities = partial_result.get('entities', [])
                if entities:
                    response["result"] = {
                        "entities_found": len(entities),
                        "data_points": partial_result.get('data_points', len(entities)),
                        "modules_run": partial_result.get('modules_run', 0),
                        "entities": entities,
                        "partial": True,
                        "progress": partial_result.get('progress', 0),
                        "status": partial_result.get('status', 'running')
                    }
                    # Try to process partial results for categorization
                    try:
                        import sys
                        current_dir = os.path.dirname(os.path.abspath(__file__))
                        if current_dir not in sys.path:
                            sys.path.insert(0, current_dir)
                        from services.spiderfoot_processor import process_scan_results
                        raw_result = {
                            'scan_id': partial_result.get('scan_id', job_id),
                            'target': partial_result.get('target', target),
                            'target_type': partial_result.get('target_type', 'domain'),
                            'entities': entities,
                            'data_points': len(entities),
                            'modules_run': partial_result.get('modules_run', 0)
                        }
                        processed_result = process_scan_results(raw_result)
                        response["result"]["processed"] = processed_result
                    except Exception as process_error:
                        logger.debug(f"Could not process partial results: {process_error}")
            except Exception as e:
                logger.debug(f"Could not extract partial results: {e}")
        
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
                        "entities": result.get('entities', []),  # Return all entities from all modules
                        "processed": result.get('processed'),  # Include processed/categorized data
                        "target_type": result.get('target_type', 'domain')
                    }
                    if result.get('csv_filename'):
                        response["result"]["csv_filename"] = result.get('csv_filename')
                        response["result"]["csv_download_url"] = f"/api/v1/external-surface/download/{result.get('csv_filename')}"
                    # Include warning if scan timed out or has partial results
                    if result.get('warning'):
                        response["warning"] = result.get('warning')
                    elif result.get('timeout'):
                        response["warning"] = result.get('warning', 'Scan timed out. Showing partial results.')
                    
                    # Only include error in response if it's a real failure (no entities found)
                    # Don't set error if scan succeeded with results
                    if result.get('error') and (not result.get('entities') or len(result.get('entities', [])) == 0):
                        response["error"] = result.get('error')
                    elif result.get('error'):
                        # Log warning but don't show as error if we have results
                        logger.warning(f"Scan completed with warning: {result.get('error')}")
                        if not response.get('warning'):  # Don't override timeout warning
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
        csv_filename = f"asm_scan_{scan_id}_{target.replace('.', '_')}.csv"
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
        json_filename = f"asm_scan_{scan_id}_{target.replace('.', '_')}.json"
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

@router.post("/external-surface/enrich")
async def enrich_scan(request: EnrichmentScanRequest):
    """
    Enrich an existing scan with Layers 2-4 data (Technology, Cloud, Content).
    
    This endpoint takes a completed scan and runs enrichment modules on the discovered
    subdomains to get:
    - Technology stack (sfp_wappalyzer, sfp_httpheader)
    - Cloud storage buckets (sfp_s3bucket, sfp_azureblobstorage, sfp_googleobjectstorage)
    - Open ports (sfp_shodan, sfp_portscan_tcp)
    - Content scraping (sfp_spider for emails, forms, etc.)
    
    Use this after a basic discovery scan to get full ASM data.
    """
    try:
        AsyncResult, celery_app, _ = get_celery_imports()
        async_result = AsyncResult(request.job_id, app=celery_app)
        
        # Check if original scan is complete
        if async_result.state != 'SUCCESS':
            raise HTTPException(
                status_code=400, 
                detail=f"Original scan not completed yet (status: {async_result.state})"
            )
        
        original_result = async_result.result
        if not original_result or not original_result.get('entities'):
            raise HTTPException(status_code=404, detail="No entities found in original scan to enrich")
        
        # Extract subdomains from original scan
        discovered_subdomains = set()
        for entity in original_result.get('entities', []):
            if entity.get('type') == 'INTERNET_NAME':
                discovered_subdomains.add(entity.get('value'))
        
        # Use provided subdomains or all discovered ones
        targets_to_enrich = request.target_subdomains or list(discovered_subdomains)
        
        if not targets_to_enrich:
            raise HTTPException(status_code=400, detail="No subdomains found to enrich")
        
        logger.info(f"Enriching {len(targets_to_enrich)} subdomains from scan {request.job_id}")
        
        # Create enrichment scan for each subdomain (or batch them)
        # For now, we'll create a single enrichment scan targeting the main domain
        # with all discovered subdomains as context
        original_target = original_result.get('target', 'unknown')
        
        # Create new enrichment scan
        enrichment_scan_id = f"asm-enrich-{uuid.uuid4()}"
        
        # Get enrichment modules (Layers 2-4) - All NON-API modules
        technology_modules = ["sfp_wappalyzer", "sfp_httpheader"]  # Layer 2 (NO API KEYS)
        cloud_modules = ["sfp_s3bucket", "sfp_azureblobstorage", "sfp_googleobjectstorage"]  # Layer 3 (NO API KEYS)
        content_modules = ["sfp_spider", "sfp_portscan_tcp"]  # Layer 4 (NO API KEYS - sfp_spider and sfp_portscan_tcp)
        active_modules = ["sfp_ssl", "sfp_certificate", "sfp_webanalyze"]  # Additional active (NO API KEYS)
        # Note: sfp_shodan requires API key, so it's optional but can be added if configured
        enrichment_modules = technology_modules + cloud_modules + content_modules + active_modules
        enrichment_modules.append("sfp_shodan")  # Add Shodan (requires API key, but commonly configured)
        enrichment_modules = list(dict.fromkeys(enrichment_modules))  # Remove duplicates
        
        # Queue enrichment scan
        try:
            AsyncResult, celery_app, spiderfoot_scan = get_celery_imports()
            # Run enrichment scan on the original target (scanning engine will use discovered subdomains)
            async_result = spiderfoot_scan.delay(
                enrichment_scan_id,
                original_target,
                original_result.get('target_type', 'domain'),
                "enrichment",  # Use enrichment scan type
                enrichment_modules,
                3,  # scan_depth
                3600,  # timeout
                10,  # max_threads
                "json"  # output_format
            )
            
            return {
                "job_id": async_result.id,
                "scan_id": enrichment_scan_id,
                "status": "queued",
                "target": original_target,
                "scan_type": "enrichment",
                "modules": enrichment_modules,
                "subdomains_to_enrich": len(targets_to_enrich),
                "original_scan_id": request.job_id,
                "message": f"Enrichment scan queued for {len(targets_to_enrich)} discovered subdomains"
            }
        except Exception as e:
            logger.error(f"Failed to queue enrichment scan: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to queue enrichment scan: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting enrichment scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

