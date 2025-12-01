"""
DMARC Monitoring Router - checkdmarc/parsedmarc Integration
"""

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
import subprocess
import json
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter()

# Test endpoint to verify router is working
@router.get("/dmarc/test")
async def test_dmarc_endpoint():
    """Test endpoint to verify DMARC router is registered"""
    return {"status": "ok", "message": "DMARC router is working", "endpoint": "/api/v1/dmarc/test"}

class DMARCAnalysisRequest(BaseModel):
    domain: str
    email: Optional[str] = None
    report_type: str = "aggregate"  # aggregate, forensic, both
    date_range: str = "7"  # days
    report_source: Optional[str] = None
    aggregation_period: str = "daily"  # hourly, daily, weekly, monthly

@router.post("/dmarc/analyze")
async def analyze_dmarc(request: DMARCAnalysisRequest = Body(...)):
    """Analyze DMARC reports for a domain
    
    Accepts a JSON body with:
    - domain: str (required)
    - email: Optional[str]
    - report_type: str (default: "aggregate")
    - date_range: str (default: "7")
    - report_source: Optional[str]
    - aggregation_period: str (default: "daily")
    """
    try:
        logger.info(f"DMARC analysis request received: domain={request.domain}")
        if not request.domain or not request.domain.strip():
            raise HTTPException(status_code=400, detail="Domain is required")
        
        domain = request.domain.strip().lower()
        
        # Use checkdmarc to analyze DMARC policy
        try:
            # Try to use checkdmarc if available
            try:
                import checkdmarc
            except ImportError as import_err:
                # Check if it's a missing dependency issue
                error_msg = str(import_err).lower()
                if 'pkg_resources' in error_msg or 'setuptools' in error_msg:
                    logger.error("checkdmarc requires setuptools. Install with: pip install setuptools>=65.0.0")
                    raise HTTPException(
                        status_code=503,
                        detail={
                            "error": "checkdmarc dependency missing",
                            "message": "checkdmarc requires setuptools. Please install it with: pip install setuptools>=65.0.0",
                            "installation_command": "pip install setuptools>=65.0.0 checkdmarc==4.0.0"
                        }
                    )
                else:
                    raise
            
            result = checkdmarc.check_domains([domain])
            
            # Extract DMARC policy details
            dmarc_data = result.get("dmarc", {})
            spf_data = result.get("spf", {})
            
            # checkdmarc doesn't return DKIM by default, we need to validate it separately
            # DKIM validation requires checking for actual public key records in DNS
            # NOTE: DKIM selectors are domain-specific and cannot be discovered without:
            # 1. An actual email from the domain (to extract s= tag from DKIM-Signature header)
            # 2. A DMARC aggregate report (which lists selectors used)
            # 3. Brute-forcing common patterns (limited effectiveness)
            dkim_data = {"records": [], "valid": False}
            try:
                import dns.resolver
                # Expanded DKIM selector patterns to check
                # This is a best-effort approach - actual selectors may not be in this list
                base_selectors = ["default", "selector1", "google", "mail", "k1", "s1", "dkim", "selector"]
                year_selectors = [str(year) for year in range(2020, 2026)]  # 2020-2025
                month_selectors = [f"{year}{month:02d}" for year in range(2020, 2026) for month in range(1, 13)]  # YYYYMM format
                common_patterns = ["alpha", "beta", "gamma", "delta", "key1", "key2", "dkim1", "dkim2", "default._domainkey"]
                # Domain-specific patterns (try domain name variations)
                domain_parts = domain.split('.')
                domain_selectors = [domain_parts[0]] if len(domain_parts) > 0 else []
                
                dkim_selectors = list(set(base_selectors + year_selectors + month_selectors[:24] + common_patterns + domain_selectors))
                dkim_records = []
                
                for selector in dkim_selectors:
                    try:
                        dkim_query = f"{selector}._domainkey.{domain}"
                        answers = dns.resolver.resolve(dkim_query, 'TXT', lifetime=5)
                        for rdata in answers:
                            txt_record = ''.join([s.decode('utf-8') if isinstance(s, bytes) else str(s) for s in rdata.strings])
                            if txt_record.startswith('v=DKIM1') or 'p=' in txt_record:
                                # Extract public key if present
                                public_key = None
                                if 'p=' in txt_record:
                                    parts = txt_record.split('p=')
                                    if len(parts) > 1:
                                        public_key = parts[1].split(';')[0].strip()
                                
                                dkim_records.append({
                                    "selector": selector,
                                    "record": txt_record[:200],  # Limit record length
                                    "valid": public_key is not None and len(public_key) > 10,  # Valid if public key exists and is substantial
                                    "public_key_present": public_key is not None,
                                    "query": dkim_query
                                })
                                break
                    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
                        # No record for this selector, continue
                        continue
                    except dns.resolver.Timeout:
                        logger.debug(f"DKIM query timeout for {selector}")
                        continue
                    except Exception as dkim_err:
                        logger.debug(f"DKIM check for {selector} failed: {dkim_err}")
                        continue
                
                dkim_data = {
                    "records": dkim_records,
                    "valid": any(rec.get("valid", False) for rec in dkim_records),
                    "selectors_checked": dkim_selectors[:50],  # Limit to first 50 for response size
                    "selectors_found": [rec.get("selector") for rec in dkim_records],
                    "validation_method": "DNS TXT record lookup with public key verification",
                    "limitation": "DKIM selectors are domain-specific and cannot be fully discovered without an actual email or DMARC report. A 'valid: false' result may indicate missing selectors rather than no DKIM configuration.",
                    "total_selectors_checked": len(dkim_selectors),
                    "recommendation": "To verify DKIM, extract the selector (s=) from an email's DKIM-Signature header, then query: [selector]._domainkey.[domain]"
                }
            except ImportError:
                logger.warning("dnspython not available for DKIM validation")
                dkim_data = {
                    "records": [],
                    "valid": False,
                    "note": "DKIM validation requires dnspython library (already in requirements.txt)"
                }
            except Exception as dkim_error:
                logger.warning(f"DKIM validation error: {dkim_error}")
                dkim_data = {
                    "records": [],
                    "valid": False,
                    "error": str(dkim_error),
                    "validation_method": "DNS lookup failed"
                }
            
            # Process report data if email is provided
            reports_data = None
            if request.email:
                try:
                    # Try to use parsedmarc if available for email report parsing
                    import parsedmarc
                    # Note: This would require IMAP/POP3 configuration
                    # For now, we'll log that email parsing is requested
                    logger.info(f"Email report parsing requested for {request.email}, but requires IMAP/POP3 configuration")
                    reports_data = {
                        "email": request.email,
                        "status": "email_parsing_requires_configuration",
                        "message": "Email report parsing requires IMAP/POP3 server configuration"
                    }
                except ImportError:
                    logger.warning("parsedmarc not available for email report parsing")
                    reports_data = {
                        "email": request.email,
                        "status": "library_not_available",
                        "message": "parsedmarc library required for email report parsing"
                    }
            
            # Filter by report source if provided
            report_source_filter = None
            if request.report_source:
                report_source_filter = [s.strip() for s in request.report_source.split(",") if s.strip()]
            
            # Format response with detailed information
            response = {
                "domain": domain,
                "dmarc_policy": {
                    "record": dmarc_data.get("record", ""),
                    "policy": dmarc_data.get("policy", "none"),
                    "subdomain_policy": dmarc_data.get("subdomain_policy"),
                    "pct": dmarc_data.get("pct", 100),
                    "rua": dmarc_data.get("rua", []),
                    "ruf": dmarc_data.get("ruf", []),
                    "valid": dmarc_data.get("valid", False)
                },
                "spf": {
                    "record": spf_data.get("record", ""),
                    "valid": spf_data.get("valid", False),
                    "dns_lookups": spf_data.get("dns_lookups", 0),
                    "parsed": spf_data.get("parsed", {})
                },
                "dkim": {
                    "records": dkim_data.get("records", []),
                    "valid": dkim_data.get("valid", False),
                    "selectors_found": dkim_data.get("selectors_found", []),
                    "selectors_checked": dkim_data.get("selectors_checked", []),
                    "validation_method": dkim_data.get("validation_method", "Not validated"),
                    "note": dkim_data.get("note", "DKIM validation checks for actual public key records in DNS")
                },
                "analysis_config": {
                    "report_type": request.report_type,
                    "date_range_days": int(request.date_range) if request.date_range.isdigit() else 7,
                    "report_source_filter": report_source_filter,
                    "aggregation_period": request.aggregation_period,
                    "email": request.email
                },
                "reports": reports_data,
                "status": "completed",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "DMARC analysis completed using checkdmarc with full DNS validation",
                "version": "2.0",  # Version indicator to verify new code is running
                "validation_details": {
                    "dmarc_validated": dmarc_data.get("valid", False),
                    "spf_validated": spf_data.get("valid", False),
                    "dkim_validated": dkim_data.get("valid", False),
                    "dkim_selectors_checked": len(dkim_data.get("selectors_checked", [])),
                    "dkim_selectors_found": len(dkim_data.get("selectors_found", []))
                }
            }
            
            # Optionally save to file for persistence
            try:
                exports_dir = os.path.join(os.path.dirname(__file__), '..', 'exports')
                os.makedirs(exports_dir, exist_ok=True)
                filename = f"dmarc_{domain}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                filepath = os.path.join(exports_dir, filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(response, f, indent=2)
                response["export_file"] = filename
                logger.info(f"DMARC analysis saved to {filepath}")
            except Exception as save_error:
                logger.warning(f"Could not save DMARC analysis to file: {save_error}")
            
            return response
        except ImportError:
            # Fallback: Return error message indicating checkdmarc needs to be installed
            logger.error("checkdmarc not installed - DMARC analysis requires checkdmarc library")
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "checkdmarc library not installed",
                    "message": "Full DMARC analysis requires checkdmarc. Please install it with: pip install checkdmarc==4.0.0",
                    "installation_command": "pip install checkdmarc==4.0.0",
                    "fallback_available": False
                }
            )
        except Exception as e:
            logger.error(f"Error analyzing DMARC: {e}", exc_info=True)
            # Check if it's a DNS/network error vs library error
            error_str = str(e).lower()
            if 'import' in error_str or 'module' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "error": "checkdmarc library error",
                        "message": f"DMARC analysis failed: {str(e)}. Please ensure checkdmarc is properly installed: pip install checkdmarc==4.0.0",
                        "installation_command": "pip install checkdmarc==4.0.0"
                    }
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "DMARC analysis failed",
                        "message": str(e),
                        "domain": domain
                    }
                )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in DMARC analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dmarc/reports/{domain}")
async def get_dmarc_reports(domain: str, days: int = 7):
    """Get DMARC aggregate reports for a domain"""
    try:
        # In production, this would parse DMARC reports from email
        # For now, return mock data structure
        return {
            "domain": domain,
            "period_days": days,
            "reports": [],
            "summary": {
                "total_emails": 0,
                "passed": 0,
                "failed": 0,
                "quarantined": 0,
                "rejected": 0
            },
            "message": "DMARC report parsing integration in progress"
        }
    except Exception as e:
        logger.error(f"Error getting DMARC reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dmarc/download/{filename}")
async def download_dmarc_export(filename: str):
    """Download a DMARC analysis export file"""
    try:
        # Security: Only allow JSON files
        if not filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        # Security: Prevent directory traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Get exports directory
        api_dir = os.path.dirname(__file__)
        api_dir = os.path.dirname(api_dir)  # Go up from routers/ to api/
        exports_dir = os.path.join(api_dir, 'exports')
        file_path = os.path.join(exports_dir, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return file
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/json',
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading DMARC export: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

