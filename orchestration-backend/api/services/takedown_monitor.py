"""
Takedown Monitoring Service
Automated monitoring and takedown system for phishing domains, fake social media profiles,
and brand impersonation detection.

Features:
- Certificate Transparency Log monitoring (CertStream)
- Phishing domain detection
- Social media profile monitoring
- Automated takedown request generation
- Integration with registrars and hosting providers
"""

import os
import re
import json
import asyncio
import logging
import subprocess
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, asdict, field
from enum import Enum
import requests
from urllib.parse import urlparse
import difflib

logger = logging.getLogger(__name__)


class ThreatType(Enum):
    """Types of threats to monitor"""
    PHISHING_DOMAIN = "phishing_domain"
    TYPOSQUAT = "typosquat"
    LOOKALIKE_DOMAIN = "lookalike_domain"
    FAKE_SOCIAL_PROFILE = "fake_social_profile"
    BRAND_IMPERSONATION = "brand_impersonation"
    MALICIOUS_APP = "malicious_app"
    COUNTERFEIT_SITE = "counterfeit_site"


class TakedownStatus(Enum):
    """Status of takedown requests"""
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    TAKEDOWN_REQUESTED = "takedown_requested"
    TAKEDOWN_PENDING = "takedown_pending"
    TAKEDOWN_COMPLETED = "takedown_completed"
    TAKEDOWN_REJECTED = "takedown_rejected"
    MONITORING = "monitoring"
    FALSE_POSITIVE = "false_positive"


class Platform(Enum):
    """Platforms for monitoring"""
    DOMAIN = "domain"
    TWITTER = "twitter"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    TELEGRAM = "telegram"
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    REDDIT = "reddit"
    GITHUB = "github"
    APP_STORE = "app_store"
    PLAY_STORE = "play_store"


@dataclass
class ThreatAlert:
    """A detected threat requiring potential takedown"""
    id: str
    threat_type: str
    platform: str
    target: str  # The malicious URL/profile/domain
    brand_affected: str
    similarity_score: float
    risk_level: str  # critical, high, medium, low
    status: str
    evidence: Dict[str, Any]
    detected_at: str
    updated_at: str
    takedown_info: Optional[Dict[str, Any]] = None


@dataclass
class TakedownRequest:
    """A takedown request for a detected threat"""
    id: str
    threat_id: str
    platform: str
    target: str
    request_type: str  # abuse_report, dmca, trademark, phishing
    status: str
    submitted_at: Optional[str] = None
    response_at: Optional[str] = None
    response_details: Optional[str] = None
    ticket_id: Optional[str] = None
    contact_info: Optional[Dict[str, Any]] = None


@dataclass
class BrandConfig:
    """Configuration for brand monitoring"""
    brand_name: str
    domains: List[str]
    keywords: List[str]
    logos: List[str] = field(default_factory=list)
    social_handles: Dict[str, str] = field(default_factory=dict)
    typosquat_patterns: List[str] = field(default_factory=list)


class TakedownMonitor:
    """
    Comprehensive takedown monitoring service.
    
    Features:
    - Certificate Transparency monitoring for new suspicious domains
    - Typosquatting and lookalike domain detection
    - Social media profile monitoring
    - Automated takedown request generation
    - Takedown tracking and reporting
    """
    
    def __init__(self):
        # API Keys for various services
        self.certstream_url = os.getenv('CERTSTREAM_URL', 'wss://certstream.calidog.io')
        self.urlscan_api_key = os.getenv('URLSCAN_API_KEY')
        self.virustotal_api_key = os.getenv('VIRUSTOTAL_API_KEY')
        self.google_safebrowsing_key = os.getenv('GOOGLE_SAFEBROWSING_KEY')
        
        # Sherlock path for social media checking
        self.sherlock_path = os.getenv('SHERLOCK_PATH', 'sherlock')
        
        # Brand configurations (loaded from database in production)
        self.brand_configs: Dict[str, BrandConfig] = {}
        
        # Suspicious keyword patterns for phishing detection
        self.phishing_keywords = [
            'login', 'signin', 'verify', 'secure', 'account', 'update',
            'confirm', 'banking', 'password', 'credential', 'authenticate',
            'wallet', 'crypto', 'support', 'helpdesk', 'billing'
        ]
        
        # Common TLDs used in phishing
        self.suspicious_tlds = [
            '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club',
            '.online', '.site', '.website', '.space', '.tech', '.info'
        ]
        
        # Takedown contact database
        self.takedown_contacts = {
            'cloudflare': {
                'abuse_url': 'https://www.cloudflare.com/abuse/',
                'email': 'abuse@cloudflare.com'
            },
            'godaddy': {
                'abuse_url': 'https://supportcenter.godaddy.com/AbuseReport',
                'email': 'abuse@godaddy.com'
            },
            'namecheap': {
                'abuse_url': 'https://www.namecheap.com/support/knowledgebase/article.aspx/9196/5/how-and-where-can-i-file-abuse-complaints',
                'email': 'abuse@namecheap.com'
            },
            'google': {
                'phishing_url': 'https://safebrowsing.google.com/safebrowsing/report_phish/',
                'trademark_url': 'https://support.google.com/legal/troubleshooter/1114905'
            },
            'facebook': {
                'impersonation_url': 'https://www.facebook.com/help/contact/169486816475808',
                'trademark_url': 'https://www.facebook.com/help/contact/284186058498591'
            },
            'twitter': {
                'impersonation_url': 'https://help.twitter.com/forms/impersonation',
                'trademark_url': 'https://help.twitter.com/forms/trademark'
            },
            'instagram': {
                'impersonation_url': 'https://help.instagram.com/contact/636276399721841',
                'trademark_url': 'https://help.instagram.com/contact/372592039493026'
            }
        }
        
        logger.info("TakedownMonitor initialized")
    
    # ==================== Brand Configuration ====================
    
    def add_brand_config(self, config: BrandConfig) -> None:
        """Add or update a brand configuration for monitoring"""
        self.brand_configs[config.brand_name.lower()] = config
        
        # Generate typosquat patterns if not provided
        if not config.typosquat_patterns:
            config.typosquat_patterns = self._generate_typosquat_patterns(config.brand_name)
        
        logger.info(f"Added brand config for: {config.brand_name}")
    
    def _generate_typosquat_patterns(self, brand: str) -> List[str]:
        """Generate common typosquatting patterns for a brand"""
        patterns = []
        brand_lower = brand.lower()
        
        # Character substitutions
        substitutions = {
            'a': ['4', '@', 'q'],
            'e': ['3', '€'],
            'i': ['1', 'l', '!'],
            'o': ['0', 'ø'],
            's': ['5', '$', 'z'],
            'l': ['1', 'i'],
            't': ['7', '+'],
            'g': ['9', 'q'],
        }
        
        # Missing characters
        for i in range(len(brand_lower)):
            patterns.append(brand_lower[:i] + brand_lower[i+1:])
        
        # Double characters
        for i in range(len(brand_lower)):
            patterns.append(brand_lower[:i] + brand_lower[i] + brand_lower[i:])
        
        # Adjacent key swaps
        for i in range(len(brand_lower) - 1):
            swapped = list(brand_lower)
            swapped[i], swapped[i+1] = swapped[i+1], swapped[i]
            patterns.append(''.join(swapped))
        
        # Character substitutions
        for i, char in enumerate(brand_lower):
            if char in substitutions:
                for sub in substitutions[char]:
                    patterns.append(brand_lower[:i] + sub + brand_lower[i+1:])
        
        # Common prefixes/suffixes
        prefixes = ['my', 'the', 'get', 'go', 'i', 'e', 'web', 'app', 'official', 'real', 'secure', 'login']
        suffixes = ['app', 'web', 'online', 'login', 'secure', 'official', 'support', 'help', 'verify', 'account']
        
        for prefix in prefixes:
            patterns.append(f"{prefix}{brand_lower}")
            patterns.append(f"{prefix}-{brand_lower}")
        
        for suffix in suffixes:
            patterns.append(f"{brand_lower}{suffix}")
            patterns.append(f"{brand_lower}-{suffix}")
        
        return list(set(patterns))
    
    # ==================== Domain Monitoring ====================
    
    async def check_domain_threat(self, domain: str) -> Optional[ThreatAlert]:
        """Check if a domain is a potential threat to monitored brands"""
        domain_lower = domain.lower()
        
        for brand_name, config in self.brand_configs.items():
            # Check against typosquat patterns
            for pattern in config.typosquat_patterns:
                if pattern in domain_lower or domain_lower in pattern:
                    similarity = self._calculate_similarity(brand_name, domain_lower)
                    if similarity > 0.6:  # 60% similarity threshold
                        return await self._create_domain_threat_alert(
                            domain, config, ThreatType.TYPOSQUAT, similarity
                        )
            
            # Check for brand keywords in domain
            for keyword in config.keywords:
                if keyword.lower() in domain_lower:
                    similarity = self._calculate_similarity(config.brand_name, domain_lower)
                    return await self._create_domain_threat_alert(
                        domain, config, ThreatType.LOOKALIKE_DOMAIN, similarity
                    )
            
            # Check for exact brand name with different TLD
            for official_domain in config.domains:
                official_base = official_domain.split('.')[0]
                domain_base = domain.split('.')[0]
                if official_base.lower() == domain_base.lower() and domain not in config.domains:
                    return await self._create_domain_threat_alert(
                        domain, config, ThreatType.LOOKALIKE_DOMAIN, 0.95
                    )
        
        # Check for phishing keywords
        if self._has_phishing_indicators(domain_lower):
            return ThreatAlert(
                id=hashlib.md5(f"{domain}{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16],
                threat_type=ThreatType.PHISHING_DOMAIN.value,
                platform=Platform.DOMAIN.value,
                target=domain,
                brand_affected="unknown",
                similarity_score=0.0,
                risk_level=self._assess_domain_risk(domain),
                status=TakedownStatus.DETECTED.value,
                evidence={
                    'phishing_indicators': self._get_phishing_indicators(domain),
                    'registration_info': await self._get_whois_info(domain)
                },
                detected_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat()
            )
        
        return None
    
    async def _create_domain_threat_alert(
        self, 
        domain: str, 
        brand_config: BrandConfig, 
        threat_type: ThreatType,
        similarity: float
    ) -> ThreatAlert:
        """Create a threat alert for a suspicious domain"""
        risk_level = 'critical' if similarity > 0.9 else 'high' if similarity > 0.7 else 'medium'
        
        return ThreatAlert(
            id=hashlib.md5(f"{domain}{brand_config.brand_name}{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16],
            threat_type=threat_type.value,
            platform=Platform.DOMAIN.value,
            target=domain,
            brand_affected=brand_config.brand_name,
            similarity_score=similarity,
            risk_level=risk_level,
            status=TakedownStatus.DETECTED.value,
            evidence={
                'official_domains': brand_config.domains,
                'similarity_analysis': self._get_similarity_details(brand_config.brand_name, domain),
                'registration_info': await self._get_whois_info(domain),
                'screenshot_url': None  # Would be populated by screenshot service
            },
            detected_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )
    
    def _calculate_similarity(self, brand: str, domain: str) -> float:
        """Calculate string similarity between brand and domain"""
        # Extract domain base (without TLD)
        domain_base = domain.split('.')[0].lower()
        brand_lower = brand.lower().replace(' ', '')
        
        # Use difflib for sequence matching
        return difflib.SequenceMatcher(None, brand_lower, domain_base).ratio()
    
    def _get_similarity_details(self, brand: str, domain: str) -> Dict[str, Any]:
        """Get detailed similarity analysis"""
        domain_base = domain.split('.')[0].lower()
        brand_lower = brand.lower().replace(' ', '')
        
        return {
            'brand': brand_lower,
            'domain_base': domain_base,
            'ratio': difflib.SequenceMatcher(None, brand_lower, domain_base).ratio(),
            'matching_blocks': [
                {'a': m.a, 'b': m.b, 'size': m.size}
                for m in difflib.SequenceMatcher(None, brand_lower, domain_base).get_matching_blocks()
            ]
        }
    
    def _has_phishing_indicators(self, domain: str) -> bool:
        """Check if domain has common phishing indicators"""
        # Check for suspicious TLDs
        for tld in self.suspicious_tlds:
            if domain.endswith(tld):
                return True
        
        # Check for phishing keywords
        for keyword in self.phishing_keywords:
            if keyword in domain:
                return True
        
        # Check for excessive hyphens (common in phishing)
        if domain.count('-') > 2:
            return True
        
        # Check for IP-like patterns
        if re.match(r'\d+[-_.]\d+[-_.]\d+', domain):
            return True
        
        return False
    
    def _get_phishing_indicators(self, domain: str) -> List[str]:
        """Get list of phishing indicators found in domain"""
        indicators = []
        
        for tld in self.suspicious_tlds:
            if domain.endswith(tld):
                indicators.append(f"Suspicious TLD: {tld}")
        
        for keyword in self.phishing_keywords:
            if keyword in domain:
                indicators.append(f"Phishing keyword: {keyword}")
        
        if domain.count('-') > 2:
            indicators.append(f"Excessive hyphens: {domain.count('-')}")
        
        return indicators
    
    def _assess_domain_risk(self, domain: str) -> str:
        """Assess risk level of a domain"""
        indicators = self._get_phishing_indicators(domain)
        
        if len(indicators) >= 3:
            return 'critical'
        elif len(indicators) >= 2:
            return 'high'
        elif len(indicators) >= 1:
            return 'medium'
        return 'low'
    
    async def _get_whois_info(self, domain: str) -> Dict[str, Any]:
        """Get WHOIS information for a domain"""
        try:
            # Try python-whois if available
            import whois
            w = whois.whois(domain)
            return {
                'registrar': w.registrar if hasattr(w, 'registrar') else None,
                'creation_date': str(w.creation_date) if hasattr(w, 'creation_date') else None,
                'expiration_date': str(w.expiration_date) if hasattr(w, 'expiration_date') else None,
                'name_servers': w.name_servers if hasattr(w, 'name_servers') else None,
                'registrant_country': w.country if hasattr(w, 'country') else None
            }
        except Exception as e:
            logger.debug(f"WHOIS lookup failed for {domain}: {e}")
            return {'error': 'WHOIS lookup failed'}
    
    # ==================== Social Media Monitoring ====================
    
    async def check_social_media_threats(
        self, 
        brand_name: str,
        platforms: List[str] = None
    ) -> List[ThreatAlert]:
        """Check for fake social media profiles impersonating a brand"""
        threats = []
        
        if platforms is None:
            platforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'telegram']
        
        config = self.brand_configs.get(brand_name.lower())
        if not config:
            logger.warning(f"No brand config found for: {brand_name}")
            return threats
        
        # Generate usernames to check
        usernames_to_check = self._generate_social_username_variants(brand_name)
        
        # Use Sherlock for username checking if available
        found_profiles = await self._check_usernames_sherlock(usernames_to_check, platforms)
        
        for profile in found_profiles:
            # Skip official handles
            official_handle = config.social_handles.get(profile['platform'], '').lower()
            if profile['username'].lower() == official_handle:
                continue
            
            threat = ThreatAlert(
                id=hashlib.md5(f"{profile['url']}{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16],
                threat_type=ThreatType.FAKE_SOCIAL_PROFILE.value,
                platform=profile['platform'],
                target=profile['url'],
                brand_affected=brand_name,
                similarity_score=self._calculate_similarity(brand_name, profile['username']),
                risk_level='high' if profile['username'].lower() == brand_name.lower() else 'medium',
                status=TakedownStatus.DETECTED.value,
                evidence={
                    'username': profile['username'],
                    'platform': profile['platform'],
                    'profile_url': profile['url'],
                    'official_handle': official_handle
                },
                detected_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat()
            )
            threats.append(threat)
        
        return threats
    
    def _generate_social_username_variants(self, brand: str) -> List[str]:
        """Generate username variants to check on social media"""
        brand_clean = brand.lower().replace(' ', '')
        variants = [
            brand_clean,
            f"{brand_clean}official",
            f"official{brand_clean}",
            f"{brand_clean}_official",
            f"the{brand_clean}",
            f"{brand_clean}hq",
            f"{brand_clean}support",
            f"{brand_clean}help",
            f"real{brand_clean}",
            f"{brand_clean}app",
        ]
        
        # Add typosquat variants
        for i in range(len(brand_clean)):
            variants.append(brand_clean[:i] + brand_clean[i+1:])
        
        return list(set(variants))
    
    async def _check_usernames_sherlock(
        self, 
        usernames: List[str], 
        platforms: List[str]
    ) -> List[Dict[str, str]]:
        """Use Sherlock to check for username existence across platforms"""
        found_profiles = []
        
        try:
            for username in usernames[:10]:  # Limit to avoid rate limiting
                cmd = [self.sherlock_path, username, '--print-found', '--json', '-']
                
                process = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if process.stdout:
                    try:
                        results = json.loads(process.stdout)
                        for site, data in results.items():
                            if data.get('status') == 'Claimed':
                                platform = site.lower()
                                if not platforms or platform in platforms:
                                    found_profiles.append({
                                        'username': username,
                                        'platform': platform,
                                        'url': data.get('url_user', '')
                                    })
                    except json.JSONDecodeError:
                        pass
                        
        except FileNotFoundError:
            logger.warning("Sherlock not found. Install with: pip install sherlock-project")
        except Exception as e:
            logger.error(f"Error running Sherlock: {e}")
        
        return found_profiles
    
    # ==================== Certificate Transparency Monitoring ====================
    
    async def monitor_certificate_transparency(
        self, 
        callback=None,
        duration_seconds: int = 60
    ) -> List[ThreatAlert]:
        """
        Monitor Certificate Transparency logs for suspicious domains.
        Uses CertStream or similar service.
        """
        threats = []
        
        try:
            import certstream
            
            def cert_callback(message, context):
                if message['message_type'] == 'certificate_update':
                    all_domains = message['data']['leaf_cert']['all_domains']
                    
                    for domain in all_domains:
                        # Check against brand configs
                        asyncio.create_task(self._process_ct_domain(domain, threats, callback))
            
            logger.info("Starting Certificate Transparency monitoring...")
            certstream.listen_for_events(cert_callback, url=self.certstream_url)
            
        except ImportError:
            logger.warning("certstream not installed. Install with: pip install certstream")
            # Fallback: use certstream API
            return await self._monitor_ct_fallback(duration_seconds)
        except Exception as e:
            logger.error(f"Error monitoring CT logs: {e}")
        
        return threats
    
    async def _process_ct_domain(
        self, 
        domain: str, 
        threats: List[ThreatAlert], 
        callback=None
    ):
        """Process a domain from CT logs"""
        threat = await self.check_domain_threat(domain)
        if threat:
            threats.append(threat)
            if callback:
                await callback(threat)
    
    async def _monitor_ct_fallback(self, duration_seconds: int) -> List[ThreatAlert]:
        """Fallback CT monitoring using HTTP polling"""
        # This would poll a CT log aggregator API
        logger.info("Using fallback CT monitoring (limited functionality)")
        return []
    
    # ==================== Bulk Domain Scanning ====================
    
    async def scan_suspicious_domains(self, domains: List[str]) -> List[ThreatAlert]:
        """Scan a list of domains for threats"""
        threats = []
        
        for domain in domains:
            threat = await self.check_domain_threat(domain)
            if threat:
                threats.append(threat)
        
        return threats
    
    async def search_new_domains(
        self, 
        brand_name: str,
        days_back: int = 7
    ) -> List[ThreatAlert]:
        """Search for newly registered domains similar to a brand"""
        threats = []
        config = self.brand_configs.get(brand_name.lower())
        
        if not config:
            logger.warning(f"No brand config found for: {brand_name}")
            return threats
        
        # Generate search patterns
        patterns = config.typosquat_patterns[:20]  # Limit patterns
        
        # Search using various domain intelligence APIs
        for pattern in patterns:
            found_domains = await self._search_domain_registrations(pattern, days_back)
            for domain in found_domains:
                threat = await self.check_domain_threat(domain)
                if threat:
                    threats.append(threat)
        
        return threats
    
    async def _search_domain_registrations(
        self, 
        pattern: str, 
        days_back: int
    ) -> List[str]:
        """Search for domain registrations matching a pattern"""
        domains = []
        
        # Integration with domain intelligence APIs would go here
        # Examples: DomainTools, WhoisXML, SecurityTrails
        
        # For now, return empty (would need API integration)
        logger.debug(f"Searching for domains matching: {pattern}")
        
        return domains
    
    # ==================== Takedown Request Generation ====================
    
    def generate_takedown_request(
        self, 
        threat: ThreatAlert,
        request_type: str = 'abuse_report',
        additional_info: Dict[str, Any] = None
    ) -> TakedownRequest:
        """Generate a takedown request for a threat"""
        import uuid
        
        request = TakedownRequest(
            id=str(uuid.uuid4())[:8],
            threat_id=threat.id,
            platform=threat.platform,
            target=threat.target,
            request_type=request_type,
            status=TakedownStatus.DETECTED.value,
            contact_info=self._get_takedown_contact(threat)
        )
        
        return request
    
    def _get_takedown_contact(self, threat: ThreatAlert) -> Dict[str, Any]:
        """Get appropriate takedown contact for a threat"""
        platform = threat.platform.lower()
        
        if platform == 'domain':
            # Get registrar from WHOIS and return contact
            registrar = threat.evidence.get('registration_info', {}).get('registrar', '').lower()
            
            for key, contact in self.takedown_contacts.items():
                if key in registrar:
                    return contact
            
            # Default to Cloudflare/Google Safe Browsing
            return self.takedown_contacts.get('google', {})
        
        return self.takedown_contacts.get(platform, {})
    
    def generate_abuse_report(self, threat: ThreatAlert) -> str:
        """Generate abuse report text for a threat"""
        template = f"""
ABUSE REPORT - {threat.threat_type.upper()}

Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
Report Type: {threat.threat_type.replace('_', ' ').title()}

THREAT DETAILS
==============
Malicious URL/Domain: {threat.target}
Platform: {threat.platform}
Risk Level: {threat.risk_level.upper()}
Similarity Score: {threat.similarity_score:.2%}

BRAND AFFECTED
==============
Brand Name: {threat.brand_affected}
Official Domains: {', '.join(threat.evidence.get('official_domains', ['N/A']))}

EVIDENCE
========
Detection Date: {threat.detected_at}
Phishing Indicators: {', '.join(threat.evidence.get('phishing_indicators', ['N/A']))}

REQUESTED ACTION
================
We request immediate suspension/takedown of the above-mentioned domain/account 
as it is being used for phishing/brand impersonation purposes.

This domain/account is impersonating our brand and poses a significant risk to 
our customers and brand reputation.

Thank you for your prompt attention to this matter.
"""
        return template.strip()
    
    def generate_dmca_notice(self, threat: ThreatAlert, company_info: Dict[str, str]) -> str:
        """Generate DMCA takedown notice"""
        template = f"""
DMCA TAKEDOWN NOTICE

Date: {datetime.utcnow().strftime('%Y-%m-%d')}

To Whom It May Concern,

I am writing to report trademark infringement and request removal of infringing content.

COMPLAINANT INFORMATION
=======================
Company Name: {company_info.get('company_name', '[COMPANY NAME]')}
Contact Name: {company_info.get('contact_name', '[CONTACT NAME]')}
Contact Email: {company_info.get('contact_email', '[EMAIL]')}
Contact Address: {company_info.get('contact_address', '[ADDRESS]')}

INFRINGING CONTENT
==================
URL: {threat.target}
Type: {threat.threat_type.replace('_', ' ').title()}
Platform: {threat.platform}

ORIGINAL WORK
=============
Brand/Trademark: {threat.brand_affected}
Official Website: {', '.join(threat.evidence.get('official_domains', ['[OFFICIAL DOMAIN]']))}

STATEMENT OF GOOD FAITH
=======================
I have a good faith belief that use of the material in the manner complained of 
is not authorized by the copyright/trademark owner, its agent, or the law.

STATEMENT OF ACCURACY
=====================
The information in this notification is accurate, and under penalty of perjury, 
I am authorized to act on behalf of the owner of an exclusive right that is 
allegedly infringed.

Signature: {company_info.get('contact_name', '[SIGNATURE]')}
Date: {datetime.utcnow().strftime('%Y-%m-%d')}
"""
        return template.strip()
    
    # ==================== Reporting ====================
    
    async def get_threat_summary(self) -> Dict[str, Any]:
        """Get summary of detected threats"""
        # In production, this would query the database
        return {
            'total_threats': 0,
            'by_status': {},
            'by_type': {},
            'by_platform': {},
            'recent_threats': [],
            'takedown_success_rate': 0.0
        }
    
    async def export_threats_report(
        self, 
        threats: List[ThreatAlert],
        format: str = 'json'
    ) -> str:
        """Export threats to various formats"""
        if format == 'json':
            return json.dumps([asdict(t) for t in threats], indent=2)
        elif format == 'csv':
            import csv
            import io
            output = io.StringIO()
            if threats:
                writer = csv.DictWriter(output, fieldnames=asdict(threats[0]).keys())
                writer.writeheader()
                for threat in threats:
                    writer.writerow(asdict(threat))
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported format: {format}")


# Global instance
takedown_monitor = TakedownMonitor()

