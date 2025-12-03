"""
SpiderFoot Data Processor - Categorizes and processes SpiderFoot scan results
for comprehensive ASM (Attack Surface Management) dashboard.
"""

from typing import Dict, List, Any, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Event type categories for ASM dashboard
INFRASTRUCTURE_TYPES = [
    'IP_ADDRESS',
    'INTERNET_NAME',
    'AFFILIATE_INTERNET_NAME',
    'NETBLOCK_OWNER',
    'BGP_AS_OWNER',
    'TCP_PORT_OPEN',
    'UDP_PORT_OPEN',
]

CLOUD_STORAGE_TYPES = [
    'CLOUD_STORAGE_BUCKET',
    'CLOUD_STORAGE_BUCKET_OPEN',
    'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY',
]

WEB_APPLICATION_TYPES = [
    'WEBSERVER_BANNER',
    'SOFTWARE_USED',
    'HTTP_CODE',
    'TECHNOLOGY',
    'WEBSERVER_HTTPHEADERS',
    'TARGET_WEB_CONTENT',
    'TARGET_WEB_CONTENT_TYPE',
]

LEAKS_RISKS_TYPES = [
    'EMAIL_ADDRESS',
    'POTENTIAL_VULNERABILITY',
    'BLACKLISTED_INTERNET_NAME',
    'LEAKED_CREDENTIALS',
    'EXPOSED_API_KEY',
    'EXPOSED_SECRET',
    'LINKED_URL_INTERNAL',
    'LINKED_URL_EXTERNAL',
    'FORM_NAME',
]

def categorize_entities(entities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Categorize SpiderFoot entities into Infrastructure, Cloud, Applications, and Leaks.
    
    Returns:
        {
            'infrastructure': [...],
            'cloud_storage': [...],
            'web_applications': [...],
            'leaks_risks': [...],
            'other': [...],
            'summary': {
                'total': int,
                'infrastructure_count': int,
                'cloud_storage_count': int,
                'web_applications_count': int,
                'leaks_risks_count': int,
                'critical_findings': [...]
            }
        }
    """
    categorized = {
        'infrastructure': [],
        'cloud_storage': [],
        'web_applications': [],
        'leaks_risks': [],
        'other': []
    }
    
    critical_findings = []
    
    for entity in entities:
        entity_type = entity.get('type', '').upper()
        entity_value = entity.get('value', '')
        
        # Categorize by type
        if entity_type in INFRASTRUCTURE_TYPES:
            categorized['infrastructure'].append(entity)
        elif entity_type in CLOUD_STORAGE_TYPES:
            categorized['cloud_storage'].append(entity)
            # Flag open buckets as critical
            if entity_type == 'CLOUD_STORAGE_BUCKET_OPEN':
                critical_findings.append({
                    'type': 'critical',
                    'category': 'cloud_storage',
                    'message': f'Open cloud storage bucket found: {entity_value}',
                    'entity': entity
                })
        elif entity_type in WEB_APPLICATION_TYPES:
            categorized['web_applications'].append(entity)
        elif entity_type in LEAKS_RISKS_TYPES:
            categorized['leaks_risks'].append(entity)
            # Flag leaks as critical
            if entity_type in ['EMAIL_ADDRESS', 'LEAKED_CREDENTIALS', 'EXPOSED_API_KEY', 'EXPOSED_SECRET']:
                critical_findings.append({
                    'type': 'critical',
                    'category': 'leaks_risks',
                    'message': f'{entity_type.replace("_", " ").title()} found: {entity_value}',
                    'entity': entity
                })
        else:
            categorized['other'].append(entity)
    
    # Build summary
    summary = {
        'total': len(entities),
        'infrastructure_count': len(categorized['infrastructure']),
        'cloud_storage_count': len(categorized['cloud_storage']),
        'web_applications_count': len(categorized['web_applications']),
        'leaks_risks_count': len(categorized['leaks_risks']),
        'other_count': len(categorized['other']),
        'critical_findings': critical_findings,
        'critical_count': len(critical_findings)
    }
    
    return {
        **categorized,
        'summary': summary
    }


def group_assets_by_subdomain(entities: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Group assets by subdomain -> IP -> Tech Stack structure.
    
    Returns:
        {
            'subdomain.example.com': {
                'ips': ['1.2.3.4', '5.6.7.8'],
                'ports': [80, 443],
                'technologies': ['nginx', 'react'],
                'status_code': 200,
                'banner': 'nginx/1.18',
                'cloud_buckets': [],
                'emails': []
            }
        }
    """
    assets = {}
    
    # First pass: collect all subdomains and their IPs
    subdomain_to_ips = {}
    for entity in entities:
        entity_type = entity.get('type', '').upper()
        entity_value = entity.get('value', '')
        
        if entity_type == 'INTERNET_NAME':
            if entity_value not in assets:
                assets[entity_value] = {
                    'subdomain': entity_value,
                    'ips': [],
                    'ports': [],
                    'technologies': [],
                    'status_code': None,
                    'banner': None,
                    'cloud_buckets': [],
                    'emails': [],
                    'vulnerabilities': []
                }
        elif entity_type == 'IP_ADDRESS':
            # Find associated subdomain (this is simplified - in real SpiderFoot, 
            # entities have relationships)
            # For now, we'll collect IPs separately
            pass
    
    # Second pass: enrich with additional data
    for entity in entities:
        entity_type = entity.get('type', '').upper()
        entity_value = entity.get('value', '')
        
        # Map IPs to subdomains (simplified - would need relationship data)
        if entity_type == 'IP_ADDRESS':
            # In real implementation, use SpiderFoot's entity relationships
            pass
        
        # Map technologies
        if entity_type == 'SOFTWARE_USED' or entity_type == 'TECHNOLOGY':
            # Try to find associated subdomain (simplified)
            for subdomain in assets.keys():
                if subdomain in entity_value or entity_value in subdomain:
                    if entity_value not in assets[subdomain]['technologies']:
                        assets[subdomain]['technologies'].append(entity_value)
        
        # Map HTTP codes
        if entity_type == 'HTTP_CODE':
            # Would need relationship data to map to subdomain
            pass
        
        # Map banners
        if entity_type == 'WEBSERVER_BANNER':
            # Would need relationship data
            pass
        
        # Map cloud buckets
        if entity_type in CLOUD_STORAGE_TYPES:
            # Would need relationship data
            pass
        
        # Map emails
        if entity_type == 'EMAIL_ADDRESS':
            # Would need relationship data
            pass
    
    return assets


def process_scan_results(scan_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process raw SpiderFoot scan results into structured ASM dashboard data.
    
    Args:
        scan_result: Raw scan result from SpiderFoot
        
    Returns:
        Processed result with categorized data and summaries
    """
    entities = scan_result.get('entities', [])
    
    # Categorize entities
    categorized = categorize_entities(entities)
    
    # Group assets by subdomain
    assets = group_assets_by_subdomain(entities)
    
    # Extract unique counts
    unique_subdomains = set()
    unique_ips = set()
    unique_emails = set()
    open_buckets = []
    
    for entity in entities:
        entity_type = entity.get('type', '').upper()
        entity_value = entity.get('value', '')
        
        if entity_type == 'INTERNET_NAME':
            unique_subdomains.add(entity_value)
        elif entity_type == 'IP_ADDRESS':
            unique_ips.add(entity_value)
        elif entity_type == 'EMAIL_ADDRESS':
            unique_emails.add(entity_value)
        elif entity_type == 'CLOUD_STORAGE_BUCKET_OPEN':
            open_buckets.append(entity_value)
    
    # Build comprehensive result
    processed_result = {
        'scan_id': scan_result.get('scan_id'),
        'target': scan_result.get('target'),
        'target_type': scan_result.get('target_type', 'domain'),
        'scan_timestamp': datetime.utcnow().isoformat(),
        'raw_entities': entities,
        'categorized': categorized,
        'assets': assets,
        'statistics': {
            'total_entities': len(entities),
            'unique_subdomains': len(unique_subdomains),
            'unique_ips': len(unique_ips),
            'unique_emails': len(unique_emails),
            'open_buckets': len(open_buckets),
            'critical_findings_count': len(categorized['summary']['critical_findings'])
        },
        'alerts': categorized['summary']['critical_findings']
    }
    
    return processed_result

