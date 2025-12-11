"""
Data Leak Monitoring Service
Agentless monitoring for database leakages, credential exposures, and dark web scanning.

Integrates:
- HaveIBeenPwned API (email/domain breach checking)
- LeakLooker-style detection (exposed databases via Shodan)
- TruffleHog (secrets scanning in repositories)
- Breach database parsing
"""

import os
import re
import sys
import json
import hashlib
import asyncio
import logging
import subprocess
import tempfile
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
import requests

logger = logging.getLogger(__name__)


class LeakType(Enum):
    """Types of data leaks"""
    BREACH = "breach"  # Email/credential found in known breach
    EXPOSED_DATABASE = "exposed_database"  # Open database found (MongoDB, Elasticsearch, etc.)
    LEAKED_SECRET = "leaked_secret"  # Secret/credential in code repository
    PASTE = "paste"  # Data found in paste sites
    DARK_WEB = "dark_web"  # Data found on dark web (requires special access)


class DatabaseType(Enum):
    """Types of exposed databases to scan for (LeakLooker style)"""
    MONGODB = "mongodb"
    ELASTICSEARCH = "elasticsearch"
    CASSANDRA = "cassandra"
    COUCHDB = "couchdb"
    REDIS = "redis"
    JENKINS = "jenkins"
    GITLAB = "gitlab"
    RSYNC = "rsync"
    SONARQUBE = "sonarqube"
    KIBANA = "kibana"


@dataclass
class LeakResult:
    """Result of a leak check"""
    leak_type: str
    source: str
    title: str
    description: str
    severity: str  # critical, high, medium, low, info
    data: Dict[str, Any]
    discovered_at: str
    target: str


@dataclass
class BreachInfo:
    """Information about a data breach"""
    name: str
    title: str
    domain: str
    breach_date: str
    added_date: str
    modified_date: str
    pwn_count: int
    description: str
    logo_path: str
    data_classes: List[str]
    is_verified: bool
    is_fabricated: bool
    is_sensitive: bool
    is_retired: bool
    is_spam_list: bool


class DataLeakMonitor:
    """
    Agentless data leak monitoring service.
    
    Features:
    - Check emails/domains against HaveIBeenPwned
    - Scan for exposed databases (LeakLooker style via Shodan)
    - Scan git repositories for leaked secrets (TruffleHog)
    - Parse and search breach databases
    - Alert system for new exposures
    """
    
    def __init__(self):
        # HaveIBeenPwned API
        self.hibp_api_key = os.getenv('HIBP_API_KEY')
        self.hibp_base_url = "https://haveibeenpwned.com/api/v3"
        
        # Shodan API (for LeakLooker-style scanning)
        self.shodan_api_key = os.getenv('SHODAN_API_KEY')
        self.shodan_base_url = "https://api.shodan.io"
        
        # TruffleHog3 path - find it in the same directory as Python executable (venv)
        default_trufflehog = 'trufflehog3'
        # Try to find trufflehog3 in the same directory as the Python executable
        python_dir = os.path.dirname(sys.executable)
        venv_trufflehog = os.path.join(python_dir, 'trufflehog3.exe' if os.name == 'nt' else 'trufflehog3')
        if os.path.exists(venv_trufflehog):
            default_trufflehog = venv_trufflehog
            logger.info(f"Found TruffleHog3 in venv: {venv_trufflehog}")
        self.trufflehog_path = os.getenv('TRUFFLEHOG_PATH', default_trufflehog)
        
        # Breach database directory (for local breach parsing)
        self.breach_db_dir = os.getenv('BREACH_DB_DIR', '')
        
        # Rate limiting for HIBP
        self._last_hibp_request = None
        self._hibp_rate_limit = 1.5  # seconds between requests (HIBP rate limit)
        
        # Cache for breach data
        self._breach_cache: Dict[str, BreachInfo] = {}
        self._cache_expiry = timedelta(hours=24)
        self._cache_timestamp: Optional[datetime] = None
        
        logger.info("DataLeakMonitor initialized")
        logger.info(f"  HIBP API: {'configured' if self.hibp_api_key else 'not configured'}")
        logger.info(f"  Shodan API: {'configured' if self.shodan_api_key else 'not configured'}")
    
    async def _rate_limit_hibp(self):
        """Enforce HIBP rate limiting"""
        if self._last_hibp_request:
            elapsed = (datetime.now() - self._last_hibp_request).total_seconds()
            if elapsed < self._hibp_rate_limit:
                await asyncio.sleep(self._hibp_rate_limit - elapsed)
        self._last_hibp_request = datetime.now()
    
    # ==================== HaveIBeenPwned Integration ====================
    
    async def check_email_breaches(self, email: str, include_unverified: bool = False) -> List[BreachInfo]:
        """
        Check if an email has been involved in known data breaches.
        Uses HaveIBeenPwned API.
        
        Args:
            email: Email address to check
            include_unverified: Include unverified breaches
            
        Returns:
            List of breaches the email was found in
        """
        if not self.hibp_api_key:
            logger.warning("HIBP API key not configured. Set HIBP_API_KEY environment variable.")
            return []
        
        await self._rate_limit_hibp()
        
        try:
            headers = {
                'hibp-api-key': self.hibp_api_key,
                'User-Agent': 'BrandMonitorAI-DataLeakMonitor'
            }
            
            params = {
                'truncateResponse': 'false'
            }
            if not include_unverified:
                params['includeUnverified'] = 'false'
            
            response = requests.get(
                f"{self.hibp_base_url}/breachedaccount/{email}",
                headers=headers,
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                breaches = response.json()
                return [self._parse_breach(b) for b in breaches]
            elif response.status_code == 404:
                # No breaches found - this is good!
                return []
            elif response.status_code == 401:
                logger.error("HIBP API key is invalid")
                return []
            elif response.status_code == 429:
                logger.warning("HIBP rate limit exceeded")
                return []
            else:
                logger.error(f"HIBP API error: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            logger.error(f"Error checking email breaches: {e}")
            return []
    
    async def check_domain_breaches(self, domain: str) -> List[BreachInfo]:
        """
        Check all breaches associated with a domain.
        Uses HaveIBeenPwned API.
        
        Args:
            domain: Domain to check (e.g., 'example.com')
            
        Returns:
            List of breaches associated with the domain
        """
        if not self.hibp_api_key:
            logger.warning("HIBP API key not configured")
            return []
        
        await self._rate_limit_hibp()
        
        try:
            headers = {
                'hibp-api-key': self.hibp_api_key,
                'User-Agent': 'BrandMonitorAI-DataLeakMonitor'
            }
            
            response = requests.get(
                f"{self.hibp_base_url}/breaches",
                headers=headers,
                params={'domain': domain},
                timeout=30
            )
            
            if response.status_code == 200:
                breaches = response.json()
                return [self._parse_breach(b) for b in breaches]
            elif response.status_code == 404:
                return []
            else:
                logger.error(f"HIBP API error: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error checking domain breaches: {e}")
            return []
    
    async def check_password_pwned(self, password: str) -> Dict[str, Any]:
        """
        Check if a password has been exposed in breaches using k-Anonymity.
        This is safe - only the first 5 chars of the SHA-1 hash are sent.
        
        Args:
            password: Password to check
            
        Returns:
            Dict with 'pwned' (bool), 'count' (int), 'safe' (bool)
        """
        try:
            # Hash the password with SHA-1
            sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
            prefix = sha1_hash[:5]
            suffix = sha1_hash[5:]
            
            # Query HIBP Passwords API (no API key needed, free)
            response = requests.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={'User-Agent': 'BrandMonitorAI-DataLeakMonitor'},
                timeout=10
            )
            
            if response.status_code == 200:
                # Check if our suffix is in the response
                for line in response.text.splitlines():
                    hash_suffix, count = line.split(':')
                    if hash_suffix == suffix:
                        return {
                            'pwned': True,
                            'count': int(count),
                            'safe': False,
                            'message': f'Password found in {count} data breaches'
                        }
                
                return {
                    'pwned': False,
                    'count': 0,
                    'safe': True,
                    'message': 'Password not found in known breaches'
                }
            else:
                logger.error(f"Password check failed: {response.status_code}")
                return {'pwned': None, 'count': 0, 'safe': None, 'error': 'API error'}
                
        except Exception as e:
            logger.error(f"Error checking password: {e}")
            return {'pwned': None, 'count': 0, 'safe': None, 'error': str(e)}
    
    async def get_all_breaches(self) -> List[BreachInfo]:
        """
        Get list of all known breaches in HIBP database.
        Useful for building local breach intelligence.
        """
        if not self.hibp_api_key:
            logger.warning("HIBP API key not configured")
            return []
        
        # Check cache
        if self._cache_timestamp and datetime.now() - self._cache_timestamp < self._cache_expiry:
            return list(self._breach_cache.values())
        
        await self._rate_limit_hibp()
        
        try:
            headers = {
                'hibp-api-key': self.hibp_api_key,
                'User-Agent': 'BrandMonitorAI-DataLeakMonitor'
            }
            
            response = requests.get(
                f"{self.hibp_base_url}/breaches",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                breaches = response.json()
                parsed = [self._parse_breach(b) for b in breaches]
                
                # Update cache
                self._breach_cache = {b.name: b for b in parsed}
                self._cache_timestamp = datetime.now()
                
                return parsed
            else:
                logger.error(f"Failed to get breaches: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting breaches: {e}")
            return []
    
    async def get_pastes_for_email(self, email: str) -> List[Dict[str, Any]]:
        """
        Get paste sites where an email has appeared.
        Uses HaveIBeenPwned API.
        """
        if not self.hibp_api_key:
            logger.warning("HIBP API key not configured")
            return []
        
        await self._rate_limit_hibp()
        
        try:
            headers = {
                'hibp-api-key': self.hibp_api_key,
                'User-Agent': 'BrandMonitorAI-DataLeakMonitor'
            }
            
            response = requests.get(
                f"{self.hibp_base_url}/pasteaccount/{email}",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return []
            else:
                logger.error(f"HIBP pastes API error: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting pastes: {e}")
            return []
    
    def _parse_breach(self, data: Dict) -> BreachInfo:
        """Parse HIBP breach data into BreachInfo object"""
        return BreachInfo(
            name=data.get('Name', ''),
            title=data.get('Title', ''),
            domain=data.get('Domain', ''),
            breach_date=data.get('BreachDate', ''),
            added_date=data.get('AddedDate', ''),
            modified_date=data.get('ModifiedDate', ''),
            pwn_count=data.get('PwnCount', 0),
            description=data.get('Description', ''),
            logo_path=data.get('LogoPath', ''),
            data_classes=data.get('DataClasses', []),
            is_verified=data.get('IsVerified', False),
            is_fabricated=data.get('IsFabricated', False),
            is_sensitive=data.get('IsSensitive', False),
            is_retired=data.get('IsRetired', False),
            is_spam_list=data.get('IsSpamList', False)
        )
    
    # ==================== LeakLooker-style Database Scanning ====================
    
    async def scan_exposed_databases(
        self, 
        domain: str = None,
        org: str = None,
        db_types: List[DatabaseType] = None,
        limit: int = 100
    ) -> List[LeakResult]:
        """
        Scan for exposed databases using Shodan (LeakLooker style).
        This is agentless - queries Shodan's database of internet scans.
        
        Args:
            domain: Target domain to search for
            org: Organization name to search for
            db_types: Types of databases to look for (default: all)
            limit: Maximum results to return
            
        Returns:
            List of exposed database findings
        """
        if not self.shodan_api_key:
            logger.warning("Shodan API key not configured. Set SHODAN_API_KEY environment variable.")
            return []
        
        if db_types is None:
            db_types = list(DatabaseType)
        
        results = []
        
        # Define Shodan queries for each database type (LeakLooker style)
        db_queries = {
            DatabaseType.MONGODB: 'product:"MongoDB" -authentication',
            DatabaseType.ELASTICSEARCH: 'product:"Elastic" port:9200',
            DatabaseType.CASSANDRA: 'product:"Cassandra"',
            DatabaseType.COUCHDB: 'product:"CouchDB"',
            DatabaseType.REDIS: 'product:"Redis" -authentication',
            DatabaseType.JENKINS: 'product:"Jenkins" http.title:"Dashboard"',
            DatabaseType.GITLAB: 'http.title:"GitLab"',
            DatabaseType.RSYNC: 'port:873 @RSYNC',
            DatabaseType.SONARQUBE: 'http.title:"SonarQube"',
            DatabaseType.KIBANA: 'kibana content-length:217'
        }
        
        for db_type in db_types:
            try:
                query = db_queries.get(db_type, '')
                if not query:
                    continue
                
                # Add domain/org filter if provided
                if domain:
                    query += f' hostname:"{domain}"'
                if org:
                    query += f' org:"{org}"'
                
                # Query Shodan
                response = requests.get(
                    f"{self.shodan_base_url}/shodan/host/search",
                    params={
                        'key': self.shodan_api_key,
                        'query': query,
                        'limit': min(limit, 100)
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    matches = data.get('matches', [])
                    
                    for match in matches:
                        severity = self._assess_db_severity(db_type, match)
                        
                        result = LeakResult(
                            leak_type=LeakType.EXPOSED_DATABASE.value,
                            source='shodan',
                            title=f"Exposed {db_type.value.upper()} Database",
                            description=f"Found exposed {db_type.value} database at {match.get('ip_str')}:{match.get('port')}",
                            severity=severity,
                            data={
                                'ip': match.get('ip_str'),
                                'port': match.get('port'),
                                'hostnames': match.get('hostnames', []),
                                'org': match.get('org', ''),
                                'isp': match.get('isp', ''),
                                'country': match.get('location', {}).get('country_name', ''),
                                'city': match.get('location', {}).get('city', ''),
                                'product': match.get('product', ''),
                                'version': match.get('version', ''),
                                'banner': match.get('data', '')[:500],  # Truncate banner
                                'database_type': db_type.value,
                                'vulns': list(match.get('vulns', {}).keys()) if match.get('vulns') else []
                            },
                            discovered_at=datetime.utcnow().isoformat(),
                            target=domain or org or 'general'
                        )
                        results.append(result)
                        
                elif response.status_code == 401:
                    logger.error("Shodan API key is invalid")
                    break
                else:
                    logger.warning(f"Shodan query failed for {db_type.value}: {response.status_code}")
                    
            except Exception as e:
                logger.error(f"Error scanning for {db_type.value}: {e}")
        
        return results
    
    async def scan_exposed_services(
        self,
        domain: str = None,
        ip: str = None
    ) -> List[LeakResult]:
        """
        Scan for exposed services using Shodan host lookup.
        
        Args:
            domain: Domain to lookup
            ip: IP address to lookup
            
        Returns:
            List of exposed service findings
        """
        if not self.shodan_api_key:
            logger.warning("Shodan API key not configured")
            return []
        
        results = []
        target_ip = ip
        
        # Resolve domain to IP if needed
        if domain and not ip:
            try:
                import socket
                target_ip = socket.gethostbyname(domain)
            except socket.gaierror:
                logger.warning(f"Could not resolve domain: {domain}")
                return []
        
        if not target_ip:
            return []
        
        try:
            response = requests.get(
                f"{self.shodan_base_url}/shodan/host/{target_ip}",
                params={'key': self.shodan_api_key},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for risky services
                risky_ports = {
                    21: ('FTP', 'high'),
                    22: ('SSH', 'medium'),
                    23: ('Telnet', 'critical'),
                    25: ('SMTP', 'medium'),
                    3306: ('MySQL', 'high'),
                    5432: ('PostgreSQL', 'high'),
                    6379: ('Redis', 'critical'),
                    27017: ('MongoDB', 'critical'),
                    9200: ('Elasticsearch', 'high'),
                    11211: ('Memcached', 'high')
                }
                
                for service in data.get('data', []):
                    port = service.get('port')
                    if port in risky_ports:
                        service_name, severity = risky_ports[port]
                        
                        result = LeakResult(
                            leak_type=LeakType.EXPOSED_DATABASE.value,
                            source='shodan',
                            title=f"Exposed {service_name} Service",
                            description=f"Found exposed {service_name} on port {port}",
                            severity=severity,
                            data={
                                'ip': target_ip,
                                'port': port,
                                'service': service_name,
                                'product': service.get('product', ''),
                                'version': service.get('version', ''),
                                'banner': service.get('data', '')[:500],
                                'vulns': list(service.get('vulns', {}).keys()) if service.get('vulns') else []
                            },
                            discovered_at=datetime.utcnow().isoformat(),
                            target=domain or target_ip
                        )
                        results.append(result)
                        
            elif response.status_code == 404:
                logger.info(f"No Shodan data for {target_ip}")
            else:
                logger.warning(f"Shodan lookup failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error scanning services: {e}")
        
        return results
    
    def _assess_db_severity(self, db_type: DatabaseType, match: Dict) -> str:
        """Assess severity of an exposed database finding"""
        # Critical if no authentication required
        if db_type in [DatabaseType.MONGODB, DatabaseType.REDIS, DatabaseType.ELASTICSEARCH]:
            data = match.get('data', '').lower()
            if 'authentication' not in data and 'unauthorized' not in data:
                return 'critical'
        
        # High if it has known vulnerabilities
        if match.get('vulns'):
            return 'high'
        
        # Medium for most exposed databases
        return 'medium'
    
    # ==================== TruffleHog Integration ====================
    
    async def scan_repository_secrets(
        self,
        repo_url: str,
        branch: str = None,
        since_commit: str = None,
        max_depth: int = None
    ) -> List[LeakResult]:
        """
        Scan a git repository for leaked secrets using TruffleHog3.
        This is agentless - scans the repo directly via URL.
        
        Args:
            repo_url: Git repository URL (GitHub, GitLab, Bitbucket, etc.)
            branch: Specific branch to scan (default: all)
            since_commit: Only scan commits after this one
            max_depth: Maximum commit depth to scan
            
        Returns:
            List of leaked secret findings
        """
        results = []
        
        try:
            logger.info(f"Running TruffleHog3 scan on {repo_url}...")
            
            # Build TruffleHog3 command - it can scan git URLs directly
            cmd = [self.trufflehog_path, '-f', 'JSON']
            
            if branch:
                cmd.extend(['--branch', branch])
            if since_commit:
                cmd.extend(['--since', since_commit])
            if max_depth:
                cmd.extend(['--depth', str(max_depth)])
            
            cmd.append(repo_url)
            
            logger.info(f"TruffleHog3 command: {' '.join(cmd)}")
            
            # Run TruffleHog3
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            # TruffleHog3 outputs JSON array
            output = process.stdout.strip()
            
            logger.info(f"TruffleHog3 output length: {len(output)} chars, return code: {process.returncode}")
            
            if output:
                try:
                    # Parse as JSON array
                    findings = json.loads(output)
                    logger.info(f"Parsed {len(findings) if isinstance(findings, list) else 1} findings from TruffleHog3")
                    
                    if isinstance(findings, list):
                        for finding in findings:
                            result = self._parse_trufflehog3_finding(finding, repo_url)
                            if result:
                                results.append(result)
                    elif isinstance(findings, dict):
                        result = self._parse_trufflehog3_finding(findings, repo_url)
                        if result:
                            results.append(result)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse TruffleHog3 JSON output: {e}")
                    logger.debug(f"Raw output (first 500 chars): {output[:500]}")
                    # Try parsing as newline-separated JSON
                    for line in output.splitlines():
                        if line.strip() and line.strip().startswith('{'):
                            try:
                                finding = json.loads(line)
                                result = self._parse_trufflehog3_finding(finding, repo_url)
                                if result:
                                    results.append(result)
                            except json.JSONDecodeError:
                                continue
            else:
                logger.warning("TruffleHog3 produced no output")
                if process.stderr:
                    logger.warning(f"TruffleHog3 stderr: {process.stderr[:500]}")
            
            # Note: return code 1 often means "found issues" not "error"
            if process.returncode != 0 and not results:
                logger.warning(f"TruffleHog3 return code {process.returncode}, stderr: {process.stderr[:500] if process.stderr else 'none'}")
            
            logger.info(f"TruffleHog3 scan completed. Found {len(results)} secrets.")
                
        except FileNotFoundError as e:
            logger.error(f"TruffleHog3 not found: {e}. Make sure trufflehog3 is installed (pip install trufflehog3).")
        except subprocess.TimeoutExpired:
            logger.error("TruffleHog3 scan timed out")
        except Exception as e:
            logger.error(f"Error running TruffleHog3: {e}", exc_info=True)
        
        return results
    
    def _parse_trufflehog3_finding(self, finding: Dict, repo_url: str) -> Optional[LeakResult]:
        """Parse a TruffleHog3 finding into a LeakResult"""
        try:
            # TruffleHog3 output format - rule can be a dict with nested severity
            rule = finding.get('rule', {})
            if isinstance(rule, dict):
                rule_id = rule.get('id', rule.get('message', 'unknown'))
                rule_severity = rule.get('severity', 'MEDIUM')
            else:
                rule_id = str(rule) if rule else 'unknown'
                rule_severity = 'MEDIUM'
            
            # Get severity (might be nested in rule or at top level)
            severity_raw = finding.get('severity', rule_severity)
            if isinstance(severity_raw, dict):
                severity_raw = severity_raw.get('severity', 'MEDIUM')
            severity = str(severity_raw).lower()
            
            if severity not in ['low', 'medium', 'high', 'critical']:
                severity = 'medium'
            
            # Extract file path
            file_path = finding.get('path', finding.get('file', 'unknown'))
            
            # Extract the secret value (redacted for safety)
            secret = finding.get('secret', finding.get('match', ''))
            if not isinstance(secret, str):
                secret = str(secret) if secret else ''
            redacted = secret[:4] + '*' * (len(secret) - 8) + secret[-4:] if len(secret) > 8 else '*' * len(secret)
            
            return LeakResult(
                leak_type=LeakType.LEAKED_SECRET.value,
                source='trufflehog3',
                title=f"Leaked Secret: {rule_id}",
                description=f"Found exposed secret in {file_path}",
                severity=severity,
                data={
                    'detector': rule_id,
                    'verified': False,
                    'redacted': redacted,
                    'file': file_path,
                    'line': str(finding.get('line', finding.get('lineNumber', ''))),
                    'commit': finding.get('commit', finding.get('commitHash', '')),
                    'author': finding.get('author', finding.get('commitAuthor', '')),
                    'date': finding.get('date', finding.get('commitDate', '')),
                    'entropy': str(finding.get('entropy', '')),
                    'source_metadata': {
                        'Data': {
                            'Git': {
                                'file': file_path,
                                'commit': finding.get('commit', finding.get('commitHash', ''))
                            }
                        }
                    }
                },
                discovered_at=datetime.utcnow().isoformat(),
                target=repo_url
            )
        except Exception as e:
            logger.error(f"Error parsing TruffleHog3 finding: {e}")
            return None
    
    async def scan_filesystem_secrets(
        self,
        path: str,
        exclude_patterns: List[str] = None
    ) -> List[LeakResult]:
        """
        Scan a local filesystem path for leaked secrets.
        
        Args:
            path: Local path to scan
            exclude_patterns: Patterns to exclude from scanning
            
        Returns:
            List of leaked secret findings
        """
        results = []
        
        try:
            cmd = [self.trufflehog_path, 'filesystem', path, '--json', '--no-update']
            
            if exclude_patterns:
                for pattern in exclude_patterns:
                    cmd.extend(['--exclude-paths', pattern])
            
            logger.info(f"Running TruffleHog filesystem scan on {path}")
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            for line in process.stdout.splitlines():
                if line.strip():
                    try:
                        finding = json.loads(line)
                        severity = self._assess_secret_severity(finding)
                        
                        result = LeakResult(
                            leak_type=LeakType.LEAKED_SECRET.value,
                            source='trufflehog',
                            title=f"Leaked {finding.get('DetectorName', 'Secret')}",
                            description=f"Found exposed secret in filesystem",
                            severity=severity,
                            data={
                                'detector': finding.get('DetectorName', ''),
                                'verified': finding.get('Verified', False),
                                'redacted': finding.get('Redacted', ''),
                                'source_metadata': finding.get('SourceMetadata', {})
                            },
                            discovered_at=datetime.utcnow().isoformat(),
                            target=path
                        )
                        results.append(result)
                        
                    except json.JSONDecodeError:
                        continue
                        
        except FileNotFoundError:
            logger.error("TruffleHog not found")
        except Exception as e:
            logger.error(f"Error running TruffleHog filesystem scan: {e}")
        
        return results
    
    def _assess_secret_severity(self, finding: Dict) -> str:
        """Assess severity of a leaked secret"""
        detector = finding.get('DetectorName', '').lower()
        verified = finding.get('Verified', False)
        
        # Critical: Verified secrets or high-value credentials
        critical_detectors = ['aws', 'gcp', 'azure', 'stripe', 'twilio', 'sendgrid', 'github', 'gitlab', 'slack']
        if verified or any(d in detector for d in critical_detectors):
            return 'critical'
        
        # High: API keys and tokens
        high_detectors = ['api', 'token', 'key', 'secret', 'password', 'private']
        if any(d in detector for d in high_detectors):
            return 'high'
        
        # Medium: Other secrets
        return 'medium'
    
    # ==================== Breach Database Parsing ====================
    
    async def search_breach_database(
        self,
        search_term: str,
        search_type: str = 'email',  # email, username, password_hash, domain
        max_results: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Search local breach database files (Breach-Parse style).
        Requires breach database files to be downloaded and configured.
        
        Args:
            search_term: Term to search for
            search_type: Type of search
            max_results: Maximum results to return
            
        Returns:
            List of matching records
        """
        if not self.breach_db_dir or not os.path.exists(self.breach_db_dir):
            logger.warning("Breach database directory not configured. Set BREACH_DB_DIR environment variable.")
            return []
        
        results = []
        
        try:
            # Search pattern based on type
            if search_type == 'email':
                pattern = re.compile(re.escape(search_term), re.IGNORECASE)
            elif search_type == 'domain':
                pattern = re.compile(r'@' + re.escape(search_term), re.IGNORECASE)
            else:
                pattern = re.compile(re.escape(search_term))
            
            # Search through breach files
            for filename in os.listdir(self.breach_db_dir):
                if len(results) >= max_results:
                    break
                    
                filepath = os.path.join(self.breach_db_dir, filename)
                if not os.path.isfile(filepath):
                    continue
                
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        for line_num, line in enumerate(f):
                            if len(results) >= max_results:
                                break
                            
                            if pattern.search(line):
                                # Parse line (common formats: email:password or email:hash)
                                parts = line.strip().split(':')
                                if len(parts) >= 2:
                                    results.append({
                                        'source_file': filename,
                                        'line_number': line_num + 1,
                                        'email': parts[0] if '@' in parts[0] else '',
                                        'credential': parts[1] if len(parts) > 1 else '',
                                        'raw_data': line.strip()[:200]  # Truncate for safety
                                    })
                except Exception as e:
                    logger.debug(f"Error reading {filename}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error searching breach database: {e}")
        
        return results
    
    # ==================== Comprehensive Scan ====================
    
    async def comprehensive_leak_scan(
        self,
        domain: str = None,
        emails: List[str] = None,
        org: str = None,
        repo_urls: List[str] = None,
        include_db_scan: bool = True,
        include_secret_scan: bool = True
    ) -> Dict[str, Any]:
        """
        Run a comprehensive data leak scan combining all methods.
        
        Args:
            domain: Target domain
            emails: List of emails to check
            org: Organization name for Shodan searches
            repo_urls: Git repository URLs to scan
            include_db_scan: Include exposed database scanning
            include_secret_scan: Include secret scanning
            
        Returns:
            Comprehensive scan results
        """
        results = {
            'scan_id': f"leak-scan-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            'started_at': datetime.utcnow().isoformat(),
            'target': domain or org or 'multiple',
            'findings': [],
            'summary': {
                'total_findings': 0,
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0,
                'info': 0,
                'breaches_found': 0,
                'exposed_databases': 0,
                'leaked_secrets': 0,
                'pastes_found': 0
            }
        }
        
        # Check email breaches
        if emails:
            for email in emails:
                breaches = await self.check_email_breaches(email)
                for breach in breaches:
                    finding = LeakResult(
                        leak_type=LeakType.BREACH.value,
                        source='hibp',
                        title=f"Email found in {breach.title} breach",
                        description=breach.description[:500] if breach.description else '',
                        severity='high' if breach.is_verified else 'medium',
                        data={
                            'email': email,
                            'breach_name': breach.name,
                            'breach_date': breach.breach_date,
                            'pwn_count': breach.pwn_count,
                            'data_classes': breach.data_classes,
                            'is_verified': breach.is_verified
                        },
                        discovered_at=datetime.utcnow().isoformat(),
                        target=email
                    )
                    results['findings'].append(asdict(finding))
                    results['summary']['breaches_found'] += 1
                
                # Check pastes
                pastes = await self.get_pastes_for_email(email)
                for paste in pastes:
                    finding = LeakResult(
                        leak_type=LeakType.PASTE.value,
                        source='hibp',
                        title=f"Email found in paste: {paste.get('Title', 'Untitled')}",
                        description=f"Email appeared in paste on {paste.get('Source', 'unknown')}",
                        severity='medium',
                        data={
                            'email': email,
                            'paste_source': paste.get('Source', ''),
                            'paste_id': paste.get('Id', ''),
                            'paste_date': paste.get('Date', '')
                        },
                        discovered_at=datetime.utcnow().isoformat(),
                        target=email
                    )
                    results['findings'].append(asdict(finding))
                    results['summary']['pastes_found'] += 1
        
        # Check domain breaches
        if domain:
            domain_breaches = await self.check_domain_breaches(domain)
            for breach in domain_breaches:
                finding = LeakResult(
                    leak_type=LeakType.BREACH.value,
                    source='hibp',
                    title=f"Domain associated with {breach.title} breach",
                    description=breach.description[:500] if breach.description else '',
                    severity='high',
                    data={
                        'domain': domain,
                        'breach_name': breach.name,
                        'breach_date': breach.breach_date,
                        'pwn_count': breach.pwn_count,
                        'data_classes': breach.data_classes
                    },
                    discovered_at=datetime.utcnow().isoformat(),
                    target=domain
                )
                results['findings'].append(asdict(finding))
                results['summary']['breaches_found'] += 1
        
        # Scan for exposed databases
        if include_db_scan and (domain or org):
            db_findings = await self.scan_exposed_databases(domain=domain, org=org)
            for finding in db_findings:
                results['findings'].append(asdict(finding))
                results['summary']['exposed_databases'] += 1
            
            # Also scan for exposed services
            if domain:
                service_findings = await self.scan_exposed_services(domain=domain)
                for finding in service_findings:
                    results['findings'].append(asdict(finding))
                    results['summary']['exposed_databases'] += 1
        
        # Scan repositories for secrets
        if include_secret_scan and repo_urls:
            for repo_url in repo_urls:
                secret_findings = await self.scan_repository_secrets(repo_url)
                for finding in secret_findings:
                    results['findings'].append(asdict(finding))
                    results['summary']['leaked_secrets'] += 1
        
        # Calculate severity summary
        for finding in results['findings']:
            severity = finding.get('severity', 'info')
            results['summary'][severity] = results['summary'].get(severity, 0) + 1
        
        results['summary']['total_findings'] = len(results['findings'])
        results['completed_at'] = datetime.utcnow().isoformat()
        
        return results


# Global instance
data_leak_monitor = DataLeakMonitor()

