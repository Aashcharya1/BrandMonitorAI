import os
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import time
from datetime import datetime
from typing import List, Dict, Any
import requests
from elasticsearch import Elasticsearch, helpers
from meilisearch import Client as MeiliClient
from celery_app import celery_app
import logging
import sys

logger = logging.getLogger(__name__)

# Add current directory to Python path for Celery imports
# This ensures 'services' module can be imported when Celery workers run
# Use absolute path to ensure it works regardless of working directory
_current_dir = os.path.dirname(os.path.abspath(__file__))
# Normalize the path to handle any path separator issues
_current_dir = os.path.normpath(_current_dir)
if _current_dir not in sys.path:
	sys.path.insert(0, _current_dir)

# Elasticsearch
ES_URL = os.getenv('ES_URL')
ES_API_KEY = os.getenv('ES_API_KEY')
ASSET_INDEX = os.getenv('ES_ASSET_INDEX', 'assets')

# Meilisearch
MEILI_URL = os.getenv('MEILI_URL')
MEILI_KEY = os.getenv('MEILI_KEY')
MEILI_INDEX = os.getenv('MEILI_INDEX', 'assets_search')


# Initialize clients (make Elasticsearch optional for initial setup)
es = None
if ES_URL and ES_API_KEY:
	try:
		es = Elasticsearch(ES_URL, api_key=ES_API_KEY, verify_certs=False)  # Set verify_certs=True in production
		logger.info("Elasticsearch client initialized")
	except Exception as e:
		logger.warning(f"Elasticsearch initialization failed: {e}")
		es = None
else:
	logger.info("ES_URL and ES_API_KEY not configured. Elasticsearch indexing disabled. (Elasticsearch is optional)")

meili = MeiliClient(MEILI_URL, MEILI_KEY) if MEILI_URL and MEILI_KEY else None

# Ensure index mapping exists (only if Elasticsearch is configured)
if es:
	try:
		if not es.indices.exists(index=ASSET_INDEX):
			es.indices.create(index=ASSET_INDEX, mappings={
				'properties': {
					'@timestamp': {'type': 'date'},
					'scan_id': {'type': 'keyword'},
					'asset': {
						'properties': {
							'domain': {'type': 'keyword'},
							'hostname': {'type': 'keyword'},
							'ip': {'type': 'ip'}
						}
					},
					'services': {
						'type': 'nested',
						'properties': {
							'port': {'type': 'integer'},
							'protocol': {'type': 'keyword'},
							'name': {'type': 'keyword'},
							'version': {'type': 'keyword'}
						}
					},
					'vulnerabilities': {
						'type': 'nested',
						'properties': {
							'plugin_id': {'type': 'keyword'},
							'name': {'type': 'text'},
							'severity': {'type': 'keyword'},
							'cvss_score': {'type': 'float'},
							'cve': {'type': 'keyword'}
						}
					}
				}
			})
			logger.info(f"Elasticsearch index '{ASSET_INDEX}' created")
	except Exception as e:
		logger.warning(f"Elasticsearch index creation failed: {e}")

def bulk_index_assets(documents: List[Dict[str, Any]]):
	"""Index documents to Elasticsearch and optionally Meilisearch."""
	if es:
		try:
			actions = [{'_index': ASSET_INDEX, '_source': doc} for doc in documents]
			helpers.bulk(es, actions)
			logger.info(f"Indexed {len(documents)} documents to Elasticsearch")
		except Exception as e:
			logger.error(f"Elasticsearch indexing error: {e}")
			# Don't raise - allow scan to complete even if indexing fails
	else:
		# Only log once at DEBUG level - Elasticsearch is optional
		logger.debug("Elasticsearch not configured. Skipping indexing. (Optional - configure ES_URL and ES_API_KEY in .env to enable)")
	
	# Meilisearch indexing (flattened for search)
	if meili:
		try:
			# Flatten documents for Meilisearch
			flat_docs = []
			for doc in documents:
				flat = {
					'scan_id': doc.get('scan_id'),
					'domain': doc.get('asset', {}).get('domain'),
					'hostname': doc.get('asset', {}).get('hostname'),
					'ip': doc.get('asset', {}).get('ip'),
					'services': json.dumps(doc.get('services', [])),
					'vulnerabilities': json.dumps(doc.get('vulnerabilities', []))
				}
				flat_docs.append(flat)
			meili.index(MEILI_INDEX).add_documents(flat_docs, primary_key='scan_id')
			logger.info(f"Indexed {len(flat_docs)} documents to Meilisearch")
		except Exception as e:
			logger.warning(f"Meilisearch indexing error: {e}")

@celery_app.task(name='scan.passive', bind=True)
def passive_scan(self, domain: str) -> Dict[str, Any]:
	"""
	Passive reconnaissance: enumerate subdomains using multiple sources.
	Uses: Certificate Transparency (crt.sh), amass, DNS brute force, and public APIs.
	Returns: {'domain': str, 'subdomains': List[str], 'host_to_ip': Dict[str, str]}
	"""
	logger.info(f"Starting passive scan for {domain}")
	subdomains = set()
	host_to_ip = {}
	
	# Method 1: Certificate Transparency (crt.sh) - Most effective for subdomain discovery
	try:
		import requests
		import time
		
		# Query crt.sh API for certificates
		crt_url = f"https://crt.sh/?q=%.{domain}&output=json"
		logger.info(f"Querying Certificate Transparency (crt.sh) for {domain}")
		
		response = requests.get(crt_url, timeout=30, headers={'User-Agent': 'BrandMonitorAI/1.0'})
		if response.status_code == 200:
			data = response.json()
			if isinstance(data, list):
				crt_subdomains = set()
				for cert in data:
					name = cert.get('name_value', '')
					if name:
						# crt.sh returns multiple names per line, split them
						for subdomain in name.split('\n'):
							subdomain = subdomain.strip().lower()
							# Remove wildcard prefix if present
							if subdomain.startswith('*.'):
								subdomain = subdomain[2:]
							# Validate it's a subdomain of our target
							if subdomain.endswith(f'.{domain}') or subdomain == domain:
								crt_subdomains.add(subdomain)
								subdomains.add(subdomain)
				logger.info(f"Certificate Transparency found {len(crt_subdomains)} unique subdomains")
			else:
				logger.warning(f"Certificate Transparency returned unexpected data format: {type(data)}")
		else:
			logger.warning(f"Certificate Transparency query returned status {response.status_code}")
		time.sleep(0.5)  # Rate limiting
	except Exception as e:
		logger.error(f"Certificate Transparency query failed: {e}", exc_info=True)
	
	# Method 2: Try amass if available (passive mode)
	try:
		with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as tmp:
			tmp_path = tmp.name
		
		# Run amass enum with passive mode
		result = subprocess.run(
			['amass', 'enum', '-passive', '-d', domain, '-json', tmp_path],
			capture_output=True,
			text=True,
			timeout=300
		)
		
		if result.returncode == 0 and os.path.exists(tmp_path):
			amass_count = 0
			with open(tmp_path, 'r') as f:
				for line in f:
					try:
						data = json.loads(line.strip())
						if data.get('name'):
							subdomains.add(data['name'].lower())
							amass_count += 1
							if data.get('addresses'):
								for addr in data['addresses']:
									if addr.get('ip'):
										host_to_ip[data['name']] = addr['ip']
					except json.JSONDecodeError:
						continue
			os.unlink(tmp_path)
			if amass_count > 0:
				logger.info(f"amass found {amass_count} additional subdomains")
			else:
				logger.debug("amass ran successfully but found no additional subdomains")
		elif result.returncode != 0:
			logger.debug(f"amass returned non-zero exit code {result.returncode}: {result.stderr[:200] if result.stderr else 'No error output'}")
	except FileNotFoundError:
		logger.debug("amass not found in PATH (optional tool)")
	except subprocess.TimeoutExpired:
		logger.warning("amass scan timed out after 300 seconds")
	except Exception as e:
		logger.debug(f"amass error: {e}")
	
	# Method 3: HackerTarget API (free, no key required)
	try:
		ht_url = f"https://api.hackertarget.com/hostsearch/?q={domain}"
		response = requests.get(ht_url, timeout=15, headers={'User-Agent': 'BrandMonitorAI/1.0'})
		if response.status_code == 200 and response.text and response.text.strip():
			ht_count = 0
			for line in response.text.strip().split('\n'):
				if ',' in line and line.strip():
					subdomain = line.split(',')[0].strip().lower()
					if subdomain.endswith(f'.{domain}') or subdomain == domain:
						subdomains.add(subdomain)
						ht_count += 1
			if ht_count > 0:
				logger.info(f"HackerTarget API found {ht_count} additional subdomains")
		time.sleep(0.5)  # Rate limiting
	except Exception as e:
		logger.debug(f"HackerTarget API query failed: {e}")
	
	# Method 4: DNS brute force with common subdomains
	try:
		import socket
		import dns.resolver
		
		# Extended list of common subdomains
		common_subs = [
			'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'webdisk', 'ns2',
			'cpanel', 'whm', 'autodiscover', 'autoconfig', 'm', 'imap', 'test', 'ns', 'blog', 'pop3',
			'dev', 'www2', 'admin', 'forum', 'news', 'vpn', 'ns3', 'mail2', 'new', 'mysql', 'old',
			'lists', 'support', 'mobile', 'mx', 'static', 'docs', 'beta', 'web2', 'www1', 'api',
			'cdn', 'stats', 'dns1', 'www3', 'dns', 'api2', 'secure', 'test2', 'ns4', 'vps',
			'mx2', 'chat', 'wap', 'svn', 'media', 'www4', 'sms', 'my', 'svr', 'dns2',
			'www5', 'id', 'srv', 'host', 'biz', 'sip', 'online', 'jabber', 'db', 'dns3',
			'search', 'staging', 'server', 'demo', 'ipv6', 'ad', 'club', 'tech', 'gateway', 'cdn2',
			'assets', 'graphql', 'hls', 'api1', 'api3', 'app', 'apps', 'auth', 'backup', 'cache',
			'cdn1', 'cdn3', 'cloud', 'dashboard', 'download', 'email', 'files', 'git', 'help',
			'images', 'img', 'login', 'logs', 'monitor', 'portal', 'proxy', 'shop', 'store', 'upload'
		]
		
		resolved_count = 0
		for sub in common_subs[:50]:  # Limit to first 50 to avoid timeout
			test_domain = f"{sub}.{domain}"
			try:
				# Try DNS resolution
				answers = dns.resolver.resolve(test_domain, 'A', lifetime=2)
				if answers:
					subdomains.add(test_domain)
					# Store IP if available
					for rdata in answers:
						host_to_ip[test_domain] = str(rdata)
					resolved_count += 1
			except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.Timeout, Exception):
				continue
		
		if resolved_count > 0:
			logger.info(f"DNS brute force resolved {resolved_count} subdomains")
	except Exception as e:
		logger.debug(f"DNS brute force failed: {e}")
	
	# Always include the root domain
	subdomains.add(domain)
	
	# Convert to sorted list and remove duplicates
	subdomains = sorted(list(subdomains))
	
	# Log summary of what was found
	total_found = len(subdomains)
	if total_found <= 1:
		logger.warning(f"Passive scan found only {total_found} subdomain(s) - results may be limited. This could indicate:")
		logger.warning(f"  1. Certificate Transparency query failed or returned no results")
		logger.warning(f"  2. amass is not installed or failed")
		logger.warning(f"  3. HackerTarget API returned no results")
		logger.warning(f"  4. DNS brute force found no additional subdomains")
		logger.warning(f"  Check logs above for specific error messages.")
	else:
		logger.info(f"Passive scan completed: found {total_found} subdomains")
		logger.info(f"  Subdomains: {', '.join(subdomains[:10])}{'...' if len(subdomains) > 10 else ''}")
	
	return {
		'domain': domain,
		'subdomains': subdomains,
		'host_to_ip': host_to_ip
	}

@celery_app.task(name='scan.active', bind=True)
def active_scan(self, hosts: List[str], host_to_ip: Dict[str, str] = None, 
                port_range: str = None, scan_intensity: str = "normal",
                max_threads: int = 10, timeout: int = 3600) -> List[Dict[str, Any]]:
	"""
	Active scanning: port discovery with masscan, then service detection with nmap.
	Returns: List of service dictionaries.
	Enforces timeout and returns partial results if timeout is reached.
	"""
	import time
	import os
	
	def is_cdn_ip(ip: str) -> bool:
		"""Check if IP belongs to a CDN (Cloudflare, Akamai, etc.)"""
		if not ip:
			return False
		# Cloudflare IP ranges (common ones)
		# 104.16.0.0/12, 172.64.0.0/13, 173.245.48.0/20, 103.21.244.0/22, 141.101.64.0/18, 108.162.192.0/18
		# 190.93.240.0/20, 188.114.96.0/20, 197.234.240.0/22, 198.41.128.0/17, 162.158.0.0/15, 104.16.0.0/13
		# 172.64.0.0/13, 131.0.72.0/22
		cloudflare_ranges = [
			(104, 16, 0, 0, 12),  # 104.16.0.0/12
			(172, 64, 0, 0, 13),  # 172.64.0.0/13
			(173, 245, 48, 0, 20),  # 173.245.48.0/20
			(103, 21, 244, 0, 22),  # 103.21.244.0/22
			(141, 101, 64, 0, 18),  # 141.101.64.0/18
			(108, 162, 192, 0, 18),  # 108.162.192.0/18
			(190, 93, 240, 0, 20),  # 190.93.240.0/20
			(188, 114, 96, 0, 20),  # 188.114.96.0/20
			(197, 234, 240, 0, 22),  # 197.234.240.0/22
			(198, 41, 128, 0, 17),  # 198.41.128.0/17
			(162, 158, 0, 0, 15),  # 162.158.0.0/15
			(131, 0, 72, 0, 22),  # 131.0.72.0/22
		]
		
		try:
			parts = ip.split('.')
			if len(parts) != 4:
				return False
			ip_bytes = tuple(int(p) for p in parts)
			
			for base_a, base_b, base_c, base_d, prefix_len in cloudflare_ranges:
				base_ip = (base_a, base_b, base_c, base_d)
				mask_bits = 32 - prefix_len
				mask = (0xFFFFFFFF << mask_bits) & 0xFFFFFFFF
				
				# Convert to integer for comparison
				base_int = (base_a << 24) | (base_b << 16) | (base_c << 8) | base_d
				ip_int = (ip_bytes[0] << 24) | (ip_bytes[1] << 16) | (ip_bytes[2] << 8) | ip_bytes[3]
				
				if (ip_int & mask) == (base_int & mask):
					return True
		except (ValueError, IndexError):
			pass
		
		return False
	
	if not hosts:
		return []
	
	scan_start_time = time.time()
	max_wait = int(timeout)
	
	logger.info(f"Starting active scan for {len(hosts)} hosts (timeout: {max_wait}s)")
	services = []
	host_to_ip = host_to_ip or {}
	
	# Check if masscan is available (cache the result to avoid repeated checks)
	masscan_available = None
	masscan_check_logged = False  # Track if we've already logged the check result
	
	hosts_processed = 0
	for host in hosts:
		# Check timeout before processing each host
		elapsed = time.time() - scan_start_time
		if elapsed >= max_wait:
			logger.warning(f"Active scan timeout reached ({max_wait}s, elapsed: {elapsed:.1f}s). Processed {hosts_processed}/{len(hosts)} hosts. Returning partial results.")
			return services  # Return partial results
		target_ip = host_to_ip.get(host, host)
		
		# Step 1: Quick port scan with masscan (if available)
		open_ports = []
		masscan_used = False
		
		# Check if masscan is available (only check once)
		if masscan_available is None:
			try:
				# First, try to find masscan in PATH using 'where' (Windows) or 'which' (Unix)
				import shutil
				masscan_path = shutil.which('masscan')
				
				if masscan_path:
					# Try to run masscan --version to verify it works
					result_check = subprocess.run(
						[masscan_path, '--version'],
						capture_output=True,
						text=True,
						timeout=5
					)
					masscan_available = result_check.returncode == 0
					if masscan_available and not masscan_check_logged:
						logger.debug(f"masscan found at {masscan_path}")
				else:
					masscan_available = False
					
			except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError, Exception) as e:
				masscan_available = False
				# Don't log - might just be permission issue or PATH issue
			
			# Only log once if masscan is not available
			if not masscan_available and not masscan_check_logged:
				masscan_check_logged = True
				logger.debug("masscan not found in PATH or not executable - using common ports list (this is normal)")
		
		# Only try to use masscan if it's available
		if masscan_available:
			try:
				with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as tmp:
					tmp_path = tmp.name
				
				# Determine port range to scan
				ports_to_scan = '1-1000'  # Default
				if port_range:
					# Validate and use provided port range
					ports_to_scan = port_range.strip()
				elif scan_intensity == "aggressive":
					ports_to_scan = '1-65535'  # Full port range
				elif scan_intensity == "intensive":
					ports_to_scan = '1-10000'  # Extended range
				# "normal" uses default 1-1000
				
				# Determine scan rate based on intensity
				scan_rate = '1000'  # Default
				if scan_intensity == "aggressive":
					scan_rate = '5000'  # Faster scan
				elif scan_intensity == "intensive":
					scan_rate = '2000'
				elif scan_intensity == "light":
					scan_rate = '500'  # Slower, less intrusive
				
				# Run masscan with configured parameters
				# Note: masscan requires admin privileges on Windows
				result = subprocess.run(
					['masscan', target_ip, f'-p{ports_to_scan}', f'--rate={scan_rate}', '-oJ', tmp_path],
					capture_output=True,
					text=True,
					timeout=min(timeout, 300)  # Cap at 5 minutes per host
				)
				
				if result.returncode == 0 and os.path.exists(tmp_path):
					with open(tmp_path, 'r') as f:
						content = f.read()
						if content.strip():  # Check if file has content
							for line in content.splitlines():
								if line.strip().startswith('{'):
									try:
										data = json.loads(line.strip())
										if data.get('ports'):
											for port_info in data['ports']:
												port_num = port_info.get('port')
												if port_num:
													open_ports.append(str(port_num))
									except json.JSONDecodeError:
										continue
					if os.path.exists(tmp_path):
						os.unlink(tmp_path)
					
					if open_ports:
						# Sort ports numerically for consistency
						try:
							open_ports = sorted([int(p) for p in open_ports])
							open_ports = [str(p) for p in open_ports]
						except ValueError:
							# If conversion fails, just sort as strings
							open_ports = sorted(open_ports, key=lambda x: int(x) if x.isdigit() else 99999)
						masscan_used = True
						logger.debug(f"masscan found {len(open_ports)} open ports for {host}")
				else:
					# masscan failed (might need admin privileges or network issue)
					if result.stderr:
						logger.debug(f"masscan execution issue for {host}: {result.stderr[:100]}")
			except (subprocess.TimeoutExpired, PermissionError, FileNotFoundError, Exception) as e:
				# PermissionError typically means admin privileges needed on Windows
				if isinstance(e, PermissionError):
					logger.debug(f"masscan requires admin privileges on Windows, using fallback ports")
				elif isinstance(e, FileNotFoundError):
					# This shouldn't happen if check worked, but handle it just in case
					logger.debug(f"masscan executable not found during execution, using fallback ports")
				else:
					logger.debug(f"masscan execution failed for {host}, using fallback: {str(e)[:50]}")
		
		# Fallback: use common ports if masscan wasn't used successfully
		if not masscan_used:
			# Use port_range if provided, otherwise use common ports
			if port_range:
				# Parse port range (e.g., "1-1000" or "80,443,8080")
				if ',' in port_range:
					# Comma-separated list
					open_ports = [p.strip() for p in port_range.split(',') if p.strip()]
				elif '-' in port_range:
					# Range format - for fallback, use common ports but log the range
					logger.info(f"Port range {port_range} specified, using common ports as fallback")
					open_ports = ['21', '22', '25', '53', '80', '110', '143', '443', '993', '995', '3306', '3389', '5432', '8080']
				else:
					# Single port
					open_ports = [port_range.strip()]
			elif scan_intensity == "aggressive":
				# More comprehensive port list for aggressive scans (sorted for consistency)
				open_ports = ['21', '22', '25', '53', '80', '110', '143', '443', '993', '995', '1723', '3306', '3389', '5432', '5900', '6379', '8080', '9200', '27017']
			elif scan_intensity == "intensive":
				# Extended port list (sorted for consistency)
				open_ports = ['21', '22', '25', '53', '80', '110', '143', '443', '993', '995', '1723', '3306', '3389', '5432', '5900', '8080']
			else:
				# Normal scan - use common ports (sorted for consistency)
				open_ports = ['21', '22', '25', '53', '80', '110', '143', '443', '993', '995', '3306', '3389', '5432', '8080']
		
		# Sort ports numerically for consistency (convert to int, sort, convert back to string)
		if open_ports:
			try:
				open_ports = sorted([int(p) for p in open_ports])
				open_ports = [str(p) for p in open_ports]
			except ValueError:
				# If conversion fails, just sort as strings
				open_ports = sorted(open_ports, key=lambda x: int(x) if x.isdigit() else 99999)
		
		if not open_ports:
			open_ports = ['80', '443']  # Default to HTTP/HTTPS
		
		# Step 2: Service/version detection with nmap
		port_str = ','.join(open_ports)
		try:
			with tempfile.NamedTemporaryFile(mode='w+', suffix='.xml', delete=False) as tmp:
				tmp_path = tmp.name
			
			# Run nmap with service/version detection
			# Use -sV for service version detection
			# Use --version-intensity 5 for thorough service detection (reduces false positives)
			# Use --max-retries 1 to avoid hanging on filtered ports
			# Use -T4 for faster scanning (balanced speed/accuracy)
			result = subprocess.run(
				['nmap', '-sV', '--version-intensity', '5', '--max-retries', '1', '-T4', '-p', port_str, target_ip, '-oX', tmp_path],
				capture_output=True,
				text=True,
				timeout=300
			)
			
			if result.returncode == 0 and os.path.exists(tmp_path):
				tree = ET.parse(tmp_path)
				root = tree.getroot()
				
				for host_elem in root.findall('host'):
					for address in host_elem.findall('address'):
						ip = address.get('addr')
					
					for ports in host_elem.findall('ports'):
						for port in ports.findall('port'):
							port_num = port.get('portid')
							protocol = port.get('protocol')
							port_state = port.find('state')
							state = port_state.get('state', 'unknown') if port_state is not None else 'unknown'
							
							# Only process ports that are actually OPEN (not filtered, closed, or unknown)
							if state.lower() not in ['open', 'open|filtered']:
								logger.debug(f"Skipping port {port_num} on {host} - state: {state}")
								continue
							
							service_elem = port.find('service')
							service_name = service_elem.get('name', 'unknown') if service_elem is not None else 'unknown'
							service_version = service_elem.get('version', '') if service_elem is not None else ''
							product = service_elem.get('product', '') if service_elem is not None else ''
							service_method = service_elem.get('method', '') if service_elem is not None else ''
							version_info = f"{product} {service_version}".strip()
							
							# Determine if this is a web port or CDN IP
							is_web_port = int(port_num) in [80, 443, 8080, 8443]
							cdn_check = is_cdn_ip(ip or target_ip)
							
							# Filtering logic - only filter obvious false positives:
							# 1. Trust all ports with state "open" (confirmed open by nmap)
							# 2. For "open|filtered" states, only filter non-web ports on CDN IPs without service
							# 3. Always trust web ports (80, 443, 8080, 8443) regardless of service detection
							
							# Only apply filtering for ambiguous "open|filtered" states on non-web ports
							if state.lower() == 'open|filtered' and not is_web_port:
								# For non-web ports on CDN IPs with ambiguous state, require some service indication
								if cdn_check:
									# Only skip if: service is unknown, no version, and method is just 'table' (guessed)
									if service_name == 'unknown' and not version_info and service_method == 'table':
										logger.debug(f"Skipping likely false positive: port {port_num} on CDN IP {ip or target_ip} - open|filtered, no service, table guess")
										continue
							
							# For confirmed "open" state, trust nmap's assessment - don't filter
							# (nmap's "open" state means the port is definitely open)
							
							services.append({
								'hostname': host,
								'ip': ip or target_ip,
								'port': int(port_num),
								'protocol': protocol or 'tcp',
								'name': service_name,
								'version': version_info or 'unknown'
							})
				
				os.unlink(tmp_path)
		except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
			logger.warning(f"nmap not available or failed for {host}: {e}")
			# Fallback: try basic socket connection to detect open ports
			# WARNING: Socket-based detection is less accurate and can produce false positives
			# Only use for web ports (80, 443, 8080) on non-CDN IPs when nmap is unavailable
			try:
				import socket
				# Map common ports to service names
				port_service_map = {
					21: 'ftp', 22: 'ssh', 25: 'smtp', 53: 'domain',
					80: 'http', 110: 'pop3', 143: 'imap', 443: 'https',
					993: 'imaps', 995: 'pop3s', 1723: 'pptp', 3306: 'mysql',
					3389: 'ms-wbt-server', 5432: 'postgresql', 5900: 'vnc',
					6379: 'redis', 8080: 'http-proxy', 9200: 'elasticsearch', 27017: 'mongodb'
				}
				
				# Check if IP is a CDN - if so, only trust web ports
				cdn_check = is_cdn_ip(target_ip if '.' in target_ip else host)
				web_ports = [80, 443, 8080, 8443]
				
				for port_str in open_ports:  # Test ALL ports for consistency
					try:
						port = int(port_str)
						
						# For CDN IPs, only report web ports (they're the only ones that make sense)
						if cdn_check and port not in web_ports:
							logger.debug(f"Skipping non-web port {port} on CDN IP {target_ip} in socket fallback (likely false positive)")
							continue
						
						sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
						sock.settimeout(2)
						result = sock.connect_ex((target_ip if '.' in target_ip else host, port))
						sock.close()
						if result == 0:  # Port is open
							service_name = port_service_map.get(port, 'unknown')
							# Mark as unverified since we couldn't use nmap
							services.append({
								'hostname': host,
								'ip': target_ip,
								'port': port,
								'protocol': 'tcp',
								'name': service_name,
								'version': 'unknown (socket fallback - unverified)'
							})
					except (ValueError, socket.gaierror, socket.error, socket.timeout) as port_error:
						# Skip this port and continue with others
						continue
			except Exception as socket_error:
				logger.warning(f"Socket-based port detection failed for {host}: {socket_error}")
				# Don't assume ports are open - only report what we can verify
		
		hosts_processed += 1
		
		# Check timeout after processing each host
		elapsed = time.time() - scan_start_time
		if elapsed >= max_wait:
			logger.warning(f"Active scan timeout reached ({max_wait}s, elapsed: {elapsed:.1f}s). Processed {hosts_processed}/{len(hosts)} hosts. Returning partial results.")
			return services  # Return partial results
	
	elapsed_time = time.time() - scan_start_time
	logger.info(f"Active scan completed in {elapsed_time:.1f}s: found {len(services)} services from {hosts_processed} hosts")
	return services

	# Reload environment variables in case they were added after worker started
	import os
	import time
	from dotenv import load_dotenv, find_dotenv
	
	# Try to find .env file in multiple locations
	env_paths = [
		find_dotenv(),  # Auto-detect
		os.path.join(os.path.dirname(__file__), '.env'),  # Same directory as tasks.py
		os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),  # Parent directory
		os.path.join(os.getcwd(), '.env'),  # Current working directory
	]
	
	env_loaded = False
	for env_path in env_paths:
		if env_path and os.path.isfile(env_path):
			load_dotenv(env_path, override=False)
			logger.debug(f"Loaded .env from: {env_path}")
			env_loaded = True
			break
	
	if not env_loaded:
		# Try default load_dotenv() as fallback
		load_dotenv()
		logger.debug("Loaded .env using default find_dotenv()")
	
	# Re-read Nessus credentials after reload
	NESSUS_URL_RELOADED = os.getenv('NESSUS_URL', 'https://nessus:8834')
	NESSUS_USERNAME_RELOADED = os.getenv('NESSUS_USERNAME', 'admin')
	NESSUS_PASSWORD_RELOADED = os.getenv('NESSUS_PASSWORD', 'admin')
	
	# Log credential status (without exposing actual password)
	logger.info(f"Nessus config - URL: {NESSUS_URL_RELOADED}, USERNAME: {NESSUS_USERNAME_RELOADED}, PASSWORD: {'SET' if NESSUS_PASSWORD_RELOADED else 'NOT SET'}")
	
	# Use reloaded values
	nessus_url = NESSUS_URL_RELOADED
	nessus_username = NESSUS_USERNAME_RELOADED
	nessus_password = NESSUS_PASSWORD_RELOADED
	
	if not nessus_username or not nessus_password:
		logger.warning("Nessus username/password not configured, skipping vulnerability scan (Nessus is optional)")
		return {'targets': targets, 'findings': [], 'skipped': 'Nessus credentials not configured (optional)'}
	
	if not nessus_url:
		logger.debug("NESSUS_URL not configured, skipping vulnerability scan (Nessus is optional)")
		return {'targets': targets, 'findings': [], 'skipped': 'NESSUS_URL not configured (optional)'}
	
	logger.info(f"Starting Nessus scan for {len(targets)} targets: {targets}")
	findings = []
	scan_id = None
	
	try:
		# Import NessusClient
		import sys
		_current_dir = os.path.dirname(os.path.abspath(__file__))
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.nessus import NessusClient
		
		# Initialize Nessus client
		client = NessusClient(url=nessus_url, username=nessus_username, password=nessus_password)
		
		# Check connectivity first
		logger.info("Checking Nessus server connectivity...")
		if not client.check_connectivity(max_retries=5, retry_delay=10):
			return {'targets': targets, 'findings': [], 'error': f'Cannot connect to Nessus server at {nessus_url}. Please ensure Nessus is running and accessible.'}
		
		# Wait for Nessus to be ready (it may be initializing)
		logger.info("Waiting for Nessus to be ready...")
		max_readiness_wait = 300  # 5 minutes
		readiness_start = time.time()
		while time.time() - readiness_start < max_readiness_wait:
			if client.check_connectivity(max_retries=1, retry_delay=1):
				# Try to authenticate to verify it's fully ready
				if client.authenticate(max_retries=1):
					logger.info("Nessus is ready and authenticated")
					break
			logger.info(f"Nessus not ready yet, waiting... (elapsed: {int(time.time() - readiness_start)}s)")
			time.sleep(10)
		else:
			return {'targets': targets, 'findings': [], 'error': f'Nessus did not become ready within {max_readiness_wait} seconds. Please check Nessus container status.'}
		
		# Combine targets into a comma-separated string
		targets_str = ','.join(targets[:10])  # Limit to 10 targets to avoid issues
		if len(targets) > 10:
			logger.warning(f"Too many targets ({len(targets)}). Limiting to first 10 targets for Nessus scan.")
		
		# Generate unique scan name
		scan_name = f"BrandMonitor Scan - {datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
		
		# 1. Create scan
		try:
			scan_data = client.create_scan(target=targets_str, name=scan_name, policy_uuid=policy_uuid)
			scan_id = scan_data.get("scan", {}).get("id")
			if not scan_id:
				return {'targets': targets, 'findings': [], 'error': 'Failed to create scan: No scan ID returned'}
			logger.info(f"Created Nessus scan: ID={scan_id}")
		except Exception as e:
			logger.error(f"Failed to create Nessus scan: {e}")
			return {'targets': targets, 'findings': [], 'error': f'Failed to create scan: {str(e)}'}
		
		# 2. Launch scan
		try:
			client.launch_scan(scan_id)
			logger.info(f"Launched Nessus scan: ID={scan_id}")
		except Exception as e:
			logger.error(f"Failed to launch Nessus scan: {e}")
			return {'targets': targets, 'findings': [], 'error': f'Failed to launch scan: {str(e)}'}
		
		# 3. Poll for completion
		max_wait = 3600  # 1 hour max
		poll_interval = 30  # Check every 30 seconds
		wait_time = 0
		
		logger.info(f"Polling scan status (max wait: {max_wait}s)...")
		while wait_time < max_wait:
			try:
				status = client.get_scan_status(scan_id)
				
				if status == "completed":
					logger.info("Scan completed, extracting vulnerabilities...")
					# Get vulnerabilities
					findings = client.get_vulnerabilities(scan_id)
					break
				elif status in ["canceled", "aborted", "error"]:
					logger.error(f"Scan {status}")
					return {'targets': targets, 'findings': [], 'error': f'Scan {status}'}
				else:
					# Still running
					logger.info(f"Scan status: {status} (waited {wait_time}s)")
				
				time.sleep(poll_interval)
				wait_time += poll_interval
			except Exception as e:
				logger.warning(f"Error checking scan status: {e}, retrying...")
				time.sleep(poll_interval)
				wait_time += poll_interval
		
		if wait_time >= max_wait:
			logger.error(f"Scan timeout after {max_wait}s")
			return {'targets': targets, 'findings': [], 'error': f'Scan timeout after {max_wait}s'}
		
		# Clean up client
		client.close()
		
		logger.info(f"Nessus scan completed: found {len(findings)} vulnerabilities")
		if findings:
			severity_counts = {}
			for f in findings:
				sev = f.get('severity_name', 'Unknown')
				severity_counts[sev] = severity_counts.get(sev, 0) + 1
			logger.info(f"Vulnerability breakdown: {severity_counts}")
		
		return {'targets': targets, 'findings': findings}
	except Exception as e:
		logger.error(f"Error during Nessus scan: {e}", exc_info=True)
		if scan_id:
			try:
				client.close()
			except:
				pass
		return {'targets': targets, 'findings': [], 'error': f'Scan failed: {str(e)}'}
































@celery_app.task(name='process_file_task')
def process_file_task(file_path: str, file_type: str) -> Dict[str, Any]:
	"""
	Celery task for asynchronous file processing.
	Handles OCR, text extraction, and analysis.
	"""
	import asyncio
	# Ensure path is set before importing
	if _current_dir not in sys.path:
		sys.path.insert(0, _current_dir)
	from services.file_processor import file_processor
	
	logger.info(f"Processing file: {file_path} (type: {file_type})")
	
	try:
		# Run async processing
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		result = loop.run_until_complete(
			file_processor.process_file(file_path, file_type)
		)
		loop.close()
		
		logger.info(f"File processing completed: {file_path}")
		return result
	except Exception as e:
		logger.error(f"File processing task failed: {e}")
		raise

@celery_app.task(name='scan.spiderfoot', bind=True)
def spiderfoot_scan(self, scan_id: str, target: str, target_type: str, scan_type: str, modules: List[str], 
					scan_depth: int, timeout: int, max_threads: int, output_format: str = "json") -> Dict[str, Any]:
	# Initialize at function level so fallback can see them
	spiderfoot_success = False
	entities_found = []
	modules_run = 0
	data_points = 0
	"""
	SpiderFoot external surface scanning.
	Agentless: Uses SpiderFoot API or CLI if available, otherwise uses alternative methods.
	
	Supports multiple target types:
	- domain: Domain name (e.g., target.com)
	- ip: IPv4/IPv6 address (e.g., 192.168.1.1)
	- asn: Autonomous System Number (e.g., AS1234)
	- netblock: Subnet/CIDR (e.g., 192.168.0.0/24)
	"""
	logger.info(f"Starting SpiderFoot scan {scan_id} for {target} (type: {target_type})")
	
	# Reload environment variables in case they were added after worker started
	from dotenv import load_dotenv
	load_dotenv()  # Reload .env file
	
	# Initialize at function level so fallback can see them
	spiderfoot_success = False
	entities_found = []
	data_points = 0
	modules_run = 0
	csv_file_path = None
	
	try:
		# Check if SpiderFoot is available via API or CLI
		# Reload env vars to get latest values
		spiderfoot_api_url = os.getenv('SPIDERFOOT_API_URL', 'http://localhost:5001')
		spiderfoot_api_key = os.getenv('SPIDERFOOT_API_KEY')
		
		logger.info(f"🔍 Checking SpiderFoot API at: {spiderfoot_api_url} (API key: {'SET' if spiderfoot_api_key else 'NOT SET'})")
		
		# If URL contains localhost, also try 127.0.0.1 as fallback
		urls_to_try = [spiderfoot_api_url]
		if 'localhost' in spiderfoot_api_url:
			urls_to_try.append(spiderfoot_api_url.replace('localhost', '127.0.0.1'))
		
		# Try to use SpiderFoot API if available
		# Note: SpiderFoot can run without API key (authentication disabled)
		# So we try to connect even if API key is not set
		if spiderfoot_api_url:
			try:
				import requests
				
				# First, verify SpiderFoot is actually running by checking if we can reach it
				# Try multiple URLs (localhost and 127.0.0.1) and multiple endpoints
				health_check_passed = False
				health_check_error = None
				working_url = None
				
				# Try each URL
				for test_url in urls_to_try:
					if health_check_passed:
						break
					
					logger.debug(f"Trying to connect to SpiderFoot at {test_url}...")
					
					# Try the root endpoint first
					try:
						health_check = requests.get(
							f'{test_url}/',
							timeout=10,  # Increased timeout
							allow_redirects=True
						)
						# Any 2xx or 3xx response means SpiderFoot is running
						if health_check.status_code < 400:
							health_check_passed = True
							working_url = test_url
							spiderfoot_api_url = test_url  # Use the working URL
							logger.info(f"✅ SpiderFoot API is reachable at {test_url} (Status: {health_check.status_code})")
							break
					except requests.RequestException as health_err:
						health_check_error = health_err
						logger.debug(f"Failed to connect to {test_url}/: {health_err}")
						
						# Try scanlist endpoint as fallback
						try:
							scanlist_check = requests.get(
								f'{test_url}/scanlist',
								timeout=10
							)
							if scanlist_check.status_code < 400:
								health_check_passed = True
								working_url = test_url
								spiderfoot_api_url = test_url  # Use the working URL
								logger.info(f"✅ SpiderFoot API is reachable at {test_url} (via /scanlist endpoint)")
								break
						except Exception as scanlist_err:
							logger.debug(f"Failed to connect to {test_url}/scanlist: {scanlist_err}")
				
				# If health check failed, log detailed error but don't fail immediately
				# Try to start a scan anyway - sometimes the health check fails but the API works
				if not health_check_passed:
					logger.warning(f"⚠️ SpiderFoot health check failed for: {', '.join(urls_to_try)}")
					logger.warning(f"   Last error: {health_check_error}")
					logger.warning(f"   Attempting to start scan anyway - health check may be too strict...")
					# Don't raise exception - try to start scan anyway
					# If the scan start fails, we'll catch that error
				
				# Create a new scan via API
				# IMPORTANT: Set scan_type to "all" to allow active modules (sfp_spider, sfp_s3bucket, etc.)
				# If scan_type is "passive", active modules like sfp_spider will be skipped
				effective_scan_type = scan_type
				if scan_type == "mvp" or scan_type == "all" or scan_type == "enrichment":
					# MVP, "all", and "enrichment" scans must allow active scanning for full results
					effective_scan_type = "all"
					logger.info(f"Scan type '{scan_type}' mapped to 'all' to enable active modules")
				elif scan_type == "passive":
					# Passive scans won't run active modules
					effective_scan_type = "passive"
					logger.warning("Passive scan type selected - active modules (sfp_spider, sfp_s3bucket, etc.) will be skipped")
				
				# Log which enrichment modules are included
				enrichment_modules_list = [m for m in modules if m in ['sfp_wappalyzer', 'sfp_httpheader', 'sfp_s3bucket', 'sfp_azureblobstorage', 'sfp_googleobjectstorage', 'sfp_spider', 'sfp_shodan', 'sfp_portscan_tcp']]
				if enrichment_modules_list:
					logger.info(f"Enrichment modules enabled: {', '.join(enrichment_modules_list)}")
				else:
					logger.warning("No enrichment modules (Layers 2-4) in module list - only Layer 1 discovery will run")
				
				# SpiderFoot uses /startscan endpoint with form data, not JSON
				# Module list should be comma-separated without 'module_' prefix
				# Format: "sfp_crt,sfp_subdomain,sfp_dnsresolve" (not "module_sfp_crt,module_sfp_subdomain")
				module_list_str = ','.join(modules) if modules else ''
				
				scan_data = {
					'scanname': f'BrandMonitorAI-{scan_id}',
					'scantarget': target,
					'modulelist': module_list_str,  # SpiderFoot expects 'modulelist' not 'module_list'
					'usecase': effective_scan_type,  # 'all', 'passive', 'footprint', 'investigate'
					'typelist': '',  # Not using type-based scanning
				}
				
				logger.info(f"SpiderFoot API scan configuration: type={effective_scan_type}, modules={len(modules)}, target_type={target_type}, target={target}")
				logger.info(f"Module list being sent: {module_list_str[:200]}{'...' if len(module_list_str) > 200 else ''}")
				
				# SpiderFoot web UI uses form data, not JSON
				# Note: SpiderFoot doesn't use Bearer token auth - it uses session-based auth or API key in query params
				# Try with API key in query params first
				# IMPORTANT: Include Accept header to get JSON response instead of HTML redirect
				response = requests.post(
					f'{spiderfoot_api_url}/startscan',
					data=scan_data,  # Use form data, not JSON
					params={'apikey': spiderfoot_api_key} if spiderfoot_api_key else {},
					headers={'Accept': 'application/json'},
					timeout=10
				)
				
				logger.info(f"SpiderFoot /startscan response: status={response.status_code}, headers={dict(response.headers)}")
				
				# SpiderFoot returns JSON array: ["SUCCESS", scan_id] or ["ERROR", message]
				if response.status_code == 200:
					try:
						response_data = response.json()
						if isinstance(response_data, list) and len(response_data) >= 2:
							if response_data[0] == "SUCCESS":
								scan_id_api = response_data[1]
								logger.info(f"SpiderFoot scan created via API: {scan_id_api}")
							else:
								error_msg = response_data[1] if len(response_data) > 1 else "Unknown error"
								logger.error(f"SpiderFoot scan creation failed: {error_msg}")
								raise Exception(f"SpiderFoot API error: {error_msg}")
						else:
							# Try to parse as regular JSON
							scan_id_api = response_data.get('id') or response_data.get('scan_id')
							if not scan_id_api:
								raise Exception("Could not parse SpiderFoot API response")
							logger.info(f"SpiderFoot scan created via API: {scan_id_api}")
					except ValueError:
						# Response might be plain text or HTML
						response_text = response.text
						logger.error(f"SpiderFoot API returned non-JSON response: {response_text[:200]}")
						raise Exception(f"SpiderFoot API returned invalid response: {response_text[:200]}")
					
					# Poll for results using SpiderFoot's web UI endpoints
					# Use the exact timeout value provided by user (in seconds)
					max_wait = int(timeout)
					wait_time = 0
					poll_interval = 5  # Check every 5 seconds for more precise timeout control
					last_entity_count = 0
					no_progress_count = 0
					scan_start_time = time.time()  # Track actual start time for precise timeout
					
					# Warn if timeout is too short for cloud storage modules
					cloud_modules_enabled = any(m in modules for m in ['sfp_s3bucket', 'sfp_azureblobstorage', 'sfp_googleobjectstorage'])
					if cloud_modules_enabled and max_wait < 300:  # Less than 5 minutes
						logger.warning(f"⚠️ Timeout ({max_wait}s) may be too short for cloud storage modules. "
									 f"Recommended: at least 300s (5 minutes) for cloud storage discovery. "
									 f"Cloud modules need time to check multiple bucket permutations and create entities.")
					
					logger.info(f"Starting to poll SpiderFoot scan {scan_id_api} (max wait: {max_wait}s, poll interval: {poll_interval}s)")
					
					while True:
						# Check actual elapsed time for precise timeout control
						elapsed_time = time.time() - scan_start_time
						if elapsed_time >= max_wait:
							logger.warning(f"Scan timeout reached ({max_wait}s, elapsed: {elapsed_time:.1f}s). Stopping scan and returning results.")
							# Stop the SpiderFoot scan immediately
							try:
								if 'scan_id_api' in locals() and scan_id_api:
									logger.info(f"Stopping SpiderFoot scan {scan_id_api} due to timeout...")
									stop_res = requests.get(
										f'{spiderfoot_api_url}/stopscan',
										params={'id': scan_id_api},
										headers={'Accept': 'application/json'},
										timeout=10
									)
									if stop_res.status_code == 200:
										logger.info(f"Successfully requested stop for scan {scan_id_api}")
									else:
										logger.warning(f"Failed to stop scan {scan_id_api}: HTTP {stop_res.status_code}")
							except Exception as stop_error:
								logger.warning(f"Error stopping SpiderFoot scan: {stop_error}")
							break
						scan_finished = False
						scan_status = "UNKNOWN"
						
						# First, check scan status using scanstatus endpoint
						try:
							status_res = requests.get(
								f'{spiderfoot_api_url}/scanstatus',
								params={'id': scan_id_api},
								headers={'Accept': 'application/json'},
								timeout=10
							)
							
							if status_res.status_code == 200:
								try:
									status_data = status_res.json()
									# scanstatus returns: [name, target, created, started, finished, status, ...]
									if isinstance(status_data, list) and len(status_data) > 5:
										scan_status = status_data[5]  # Status is at index 5
										logger.info(f"Scan {scan_id_api} status: {scan_status}")
										
										if scan_status in ['FINISHED', 'ERROR-FAILED', 'ABORTED']:
											scan_finished = True
											logger.info(f"Scan {scan_id_api} has finished with status: {scan_status}")
										elif scan_status in ['RUNNING', 'STARTING', 'STARTED']:
											logger.debug(f"Scan {scan_id_api} is still {scan_status}, continuing to poll...")
								except (ValueError, IndexError, KeyError) as parse_error:
									logger.warning(f"Could not parse scan status: {parse_error}")
						except requests.RequestException as status_error:
							logger.warning(f"Error checking scan status: {status_error}")
						
						# Get current results (even if scan is still running, we want partial results)
						try:
							results_res = requests.get(
								f'{spiderfoot_api_url}/scanexportjsonmulti',
								params={'ids': scan_id_api},
								headers={'Accept': 'application/json'},
								timeout=30
							)
							
							if results_res.status_code == 200:
								try:
									results = results_res.json()
									# SpiderFoot returns array of entities with: data, event_type, module, source_data, etc.
									if isinstance(results, list):
										# Convert SpiderFoot format to our format
										current_entities = []
										modules_that_ran = set()
										
										for item in results:
											# Skip ROOT events
											if item.get('event_type') == 'ROOT':
												continue
											
											entity = {
												'type': item.get('event_type', ''),
												'value': item.get('data', ''),
												'module': item.get('module', '')
											}
											current_entities.append(entity)
											
											module = item.get('module', '')
											if module:
												modules_that_ran.add(module)
										
										entities_found = current_entities
										data_points = len(entities_found)
										modules_run = len(modules_that_ran) if modules_that_ran else 0
										
										# Check if we're making progress
										if data_points > last_entity_count:
											no_progress_count = 0
											last_entity_count = data_points
											logger.info(f"Scan progress: {data_points} entities from {modules_run} modules (status: {scan_status})")
											logger.info(f"Modules producing output: {', '.join(sorted(modules_that_ran))}")
										else:
											no_progress_count += 1
											logger.debug(f"No new entities in this poll (count: {no_progress_count})")
										
										# If scan is finished, break out of loop
										if scan_finished:
											logger.info(f"Scan finished. Final results: {data_points} entities from {modules_run} modules")
											break
										
										# If scan is still running but we haven't seen progress in 3 polls (90 seconds), 
										# continue polling but log a warning
										if no_progress_count >= 3 and scan_status in ['RUNNING', 'STARTING', 'STARTED']:
											logger.warning(f"Scan still running but no new entities in {no_progress_count * poll_interval}s. "
														f"Expected {len(modules)} modules, but only {modules_run} have produced output so far.")
											logger.warning(f"Missing modules: {', '.join(sorted(set(modules) - modules_that_ran))}")
										
								except ValueError:
									# Not JSON, might be HTML error page
									logger.warning(f"SpiderFoot returned non-JSON response: {results_res.text[:200]}")
						except requests.RequestException as req_error:
							logger.warning(f"Error getting scan results: {req_error}")
						
						# If scan is finished, wait a consistent time for all entities to be saved, then break
						if scan_finished:
							# Wait consistently for all modules to finish processing and save entities
							# This ensures consistent results for the same inputs
							wait_after_completion = 5  # Fixed 5 seconds wait for all scans
							logger.info(f"Scan finished. Waiting {wait_after_completion}s for all entities to be saved to database...")
							time.sleep(wait_after_completion)
							break
						
						# Update task state with partial results for frontend
						elapsed_time = time.time() - scan_start_time
						progress_pct = min(100, int((elapsed_time / max_wait) * 100))
						partial_result = {
							'scan_id': scan_id,
							'target': target,
							'target_type': target_type,
							'entities': entities_found if 'entities_found' in locals() else [],
							'data_points': len(entities_found) if 'entities_found' in locals() else 0,
							'modules_run': modules_run,
							'status': scan_status,
							'partial': True,
							'progress': progress_pct
						}
						self.update_state(state='PROGRESS', meta=partial_result)
						
						# Check if we should sleep before next poll
						elapsed_time = time.time() - scan_start_time
						remaining_time = max_wait - elapsed_time
						
						if remaining_time <= 0:
							# Timeout reached, break immediately (already handled at start of loop)
							break
						elif remaining_time < poll_interval:
							# Sleep for remaining time only
							time.sleep(remaining_time)
							break
						else:
							# Sleep for full poll interval
							time.sleep(poll_interval)
					
					# Check if we timed out (scan was stopped due to timeout)
					elapsed_time = time.time() - scan_start_time
					if elapsed_time >= max_wait and not scan_finished:
						entities_count = len(entities_found) if 'entities_found' in locals() else 0
						
						# Short, consistent grace period to allow modules to save any pending entities
						# This ensures consistent results for the same timeout values
						grace_period = 10  # Fixed 10 seconds grace period for all scans
						logger.info(f"Scan timeout reached ({max_wait}s, elapsed: {elapsed_time:.1f}s). Allowing {grace_period}s grace period for modules to save pending entities...")
						
						grace_start = time.time()
						grace_poll_count = 0
						while (time.time() - grace_start) < grace_period:
							# Poll for results during grace period to catch entities as they're created
							if grace_poll_count % 2 == 0:  # Poll every 5 seconds (2 * 2.5s sleep)
								try:
									results_res = requests.get(
										f'{spiderfoot_api_url}/scanexportjsonmulti',
										params={'ids': scan_id_api},  # Use 'ids' (plural) not 'id'
										headers={'Accept': 'application/json'},
										timeout=10
									)
									if results_res.status_code == 200:
										try:
											results_data = results_res.json()
											if isinstance(results_data, list):
												current_entities = []
												current_modules_that_ran = set()
												for item in results_data:
													# Skip ROOT events
													if item.get('event_type') == 'ROOT':
														continue
													
													# Get event type and data (correct field names)
													event_type = item.get('event_type', '')
													event_data = item.get('data', '')
													module = item.get('module', '')
													
													# Only add if we have valid data
													if event_type and event_data:
														entity = {
															'type': event_type,
															'value': event_data,
															'module': module
														}
														current_entities.append(entity)
														
														if module:
															current_modules_that_ran.add(module)
												
												# Update entities if we found more
												old_count = entities_count
												if len(current_entities) > entities_count:
													entities_found = current_entities
													entities_count = len(entities_found)
													if 'modules_that_ran' not in locals():
														modules_that_ran = set()
													modules_that_ran.update(current_modules_that_ran)
													logger.info(f"Grace period: Found {entities_count} entities (was {old_count})")
										except ValueError:
											pass
								except Exception as grace_poll_error:
									logger.debug(f"Error polling during grace period: {grace_poll_error}")
							
							# Check if scan finished during grace period
							try:
								status_res = requests.get(
									f'{spiderfoot_api_url}/scanstatus',
									params={'id': scan_id_api},
									headers={'Accept': 'application/json'},
									timeout=5
								)
								if status_res.status_code == 200:
									status_data = status_res.json()
									if isinstance(status_data, list) and len(status_data) > 5:
										current_status = status_data[5]
										if current_status in ['FINISHED', 'ABORTED', 'ABORT-REQUESTED']:
											logger.info(f"Scan finished during grace period with status: {current_status}")
											scan_finished = True
											break
							except Exception:
								pass
							
							time.sleep(2)  # Check every 2 seconds
							grace_poll_count += 1
						
						logger.warning(f"Scan timed out after {max_wait}s (with {grace_period}s grace period). Returning partial results with {entities_count} entities.")
						
						# Stop the SpiderFoot scan since we're returning partial results
						try:
							if 'scan_id_api' in locals() and scan_id_api:
								logger.info(f"Stopping SpiderFoot scan {scan_id_api} due to timeout...")
								stop_res = requests.get(
									f'{spiderfoot_api_url}/stopscan',
									params={'id': scan_id_api},
									headers={'Accept': 'application/json'},
									timeout=10
								)
								if stop_res.status_code == 200:
									logger.info(f"Successfully requested stop for scan {scan_id_api}")
								else:
									logger.warning(f"Failed to stop scan {scan_id_api}: HTTP {stop_res.status_code}")
						except Exception as stop_error:
							logger.warning(f"Error stopping SpiderFoot scan: {stop_error}")
						
						# Wait a short, consistent time for final results to be saved to database
						# This ensures consistent results for the same timeout values
						wait_time_after_grace = 5  # Fixed 5 seconds wait for all scans
						logger.info(f"Waiting {wait_time_after_grace} seconds for final results to be saved to database...")
						time.sleep(wait_time_after_grace)
						
						# Final poll to get any last-minute entities
						try:
							results_res = requests.get(
								f'{spiderfoot_api_url}/scanexportjsonmulti',
								params={'ids': scan_id_api},
								headers={'Accept': 'application/json'},
								timeout=30
							)
							if results_res.status_code == 200:
								results_data = results_res.json()
								if isinstance(results_data, list):
									final_entities = []
									final_modules_that_ran = set()
									for item in results_data:
										if item.get('event_type') == 'ROOT':
											continue
										event_type = item.get('event_type', '')
										event_data = item.get('data', '')
										module = item.get('module', '')
										if event_type and event_data:
											entity = {
												'type': event_type,
												'value': event_data,
												'module': module
											}
											final_entities.append(entity)
											if module:
												final_modules_that_ran.add(module)
									
									if len(final_entities) > entities_count:
										entities_found = final_entities
										entities_count = len(entities_found)
										if 'modules_that_ran' not in locals():
											modules_that_ran = set()
										modules_that_ran.update(final_modules_that_ran)
										logger.info(f"Final poll after grace period: Found {entities_count} entities")
						except Exception as final_poll_error:
							logger.debug(f"Error in final poll: {final_poll_error}")
						
						# Return partial results (even if empty)
						entities_found = entities_found if 'entities_found' in locals() else []
						data_points = len(entities_found)
						modules_run = len(modules_that_ran) if 'modules_that_ran' in locals() and modules_that_ran else 0
						
						# Process partial results
						try:
							# Ensure path is set before importing
							if _current_dir not in sys.path:
								sys.path.insert(0, _current_dir)
							from services.spiderfoot_processor import process_scan_results
							raw_result = {
								'scan_id': scan_id,
								'target': target,
								'target_type': target_type,
								'entities': entities_found,
								'data_points': data_points,
								'modules_run': modules_run
							}
							processed_result = process_scan_results(raw_result)
							result = {
								**raw_result,
								'processed': processed_result,
								'partial': True,
								'timeout': True,
								'warning': f'Scan timed out after {max_wait}s. Showing partial results with {entities_count} entities.'
							}
						except Exception as process_error:
							logger.warning(f"Failed to process partial results: {process_error}")
							result = {
								'scan_id': scan_id,
								'target': target,
								'target_type': target_type,
								'entities': entities_found,
								'data_points': data_points,
								'modules_run': modules_run,
								'partial': True,
								'timeout': True,
								'warning': f'Scan timed out after {max_wait}s. Showing partial results with {entities_count} entities.'
							}
						return result
					
					# Final attempt to get all results after polling completes
					# Always retrieve final results, even if we got some during polling
					# This ensures we get the complete dataset, including any entities created during grace period
					logger.info("Retrieving final complete scan results (including any from grace period)...")
					
					# Small, consistent delay to ensure all database writes are complete
					# This ensures consistent results for the same timeout values
					time.sleep(3)  # Fixed 3 seconds delay for all scans
					
					# Check final status first
					final_status = "UNKNOWN"
					try:
						status_res = requests.get(
							f'{spiderfoot_api_url}/scanstatus',
							params={'id': scan_id_api},
							headers={'Accept': 'application/json'},
							timeout=10
						)
						if status_res.status_code == 200:
							status_data = status_res.json()
							if isinstance(status_data, list) and len(status_data) > 5:
								final_status = status_data[5]
								logger.info(f"Final scan status: {final_status}")
					except Exception as status_err:
						logger.warning(f"Could not check final scan status: {status_err}")
					
					# Always retrieve final results, clearing any partial results from polling
					try:
							
							# Get all results - this should return the complete dataset
							results_res = requests.get(
								f'{spiderfoot_api_url}/scanexportjsonmulti',
								params={'ids': scan_id_api},
								headers={'Accept': 'application/json'},
								timeout=60  # Increased timeout for large result sets
							)
							
							if results_res.status_code == 200:
								results = results_res.json()
								logger.info(f"Received {len(results) if isinstance(results, list) else 0} raw results from SpiderFoot")
								
								if isinstance(results, list):
									# Convert SpiderFoot format to our format
									# Clear any partial results from polling
									entities_found = []
									modules_that_ran = set()
									
									for item in results:
										# Skip ROOT events
										if item.get('event_type') == 'ROOT':
											continue
										
										# Get event type and data
										event_type = item.get('event_type', '')
										event_data = item.get('data', '')
										module = item.get('module', '')
										
										# Only add if we have valid data
										if event_type and event_data:
											entity = {
												'type': event_type,
												'value': event_data,
												'module': module
											}
											entities_found.append(entity)
											
											if module:
												modules_that_ran.add(module)
									
									logger.info(f"Parsed {len(entities_found)} entities from {len(results)} raw results")
									
									# Log entity type distribution for debugging
									entity_type_counts = {}
									for entity in entities_found:
										etype = entity.get('type', 'UNKNOWN')
										entity_type_counts[etype] = entity_type_counts.get(etype, 0) + 1
									
									logger.info(f"Entity type distribution: {dict(sorted(entity_type_counts.items(), key=lambda x: x[1], reverse=True)[:10])}")
									
									# Log module distribution for debugging consistency
									module_counts = {}
									for entity in entities_found:
										module = entity.get('module', 'UNKNOWN')
										module_counts[module] = module_counts.get(module, 0) + 1
									logger.info(f"Module distribution (top 10): {dict(sorted(module_counts.items(), key=lambda x: x[1], reverse=True)[:10])}")
									logger.info(f"Total entities by module: {sum(module_counts.values())} entities from {len(module_counts)} modules")
									
									data_points = len(entities_found)
									modules_run = len(modules_that_ran) if modules_that_ran else 0
									
									logger.info(f"Final scan results: {data_points} entities found from {modules_run} modules")
									logger.info(f"All modules that produced output: {', '.join(sorted(modules_that_ran))}")
									
									# Log which modules were expected but didn't produce output
									expected_modules = set(modules)
									missing_modules = expected_modules - modules_that_ran
									
									# Categorize missing modules by layer
									if missing_modules:
										missing_layer1 = [m for m in missing_modules if m in ['sfp_crt', 'sfp_subdomain', 'sfp_dnsresolve', 'sfp_whois']]
										missing_layer2 = [m for m in missing_modules if m in ['sfp_wappalyzer', 'sfp_httpheader']]
										missing_layer3 = [m for m in missing_modules if m in ['sfp_s3bucket', 'sfp_azureblobstorage', 'sfp_googleobjectstorage']]
										missing_layer4 = [m for m in missing_modules if m in ['sfp_spider', 'sfp_shodan', 'sfp_portscan_tcp']]
										
										logger.warning(f"⚠️ {len(missing_modules)} modules were enabled but produced NO output:")
										if missing_layer1:
											logger.warning(f"  Layer 1 (Discovery): {', '.join(missing_layer1)}")
										if missing_layer2:
											logger.warning(f"  Layer 2 (Technology): {', '.join(missing_layer2)}")
											logger.warning(f"    → sfp_wappalyzer needs Wappalyzer tool installed")
											logger.warning(f"    → sfp_httpheader needs scan type 'all' (active scanning)")
										if missing_layer3:
											logger.warning(f"  Layer 3 (Cloud): {', '.join(missing_layer3)}")
											logger.warning(f"    → These modules need scan type 'all' (active scanning)")
										if missing_layer4:
											logger.warning(f"  Layer 4 (Content): {', '.join(missing_layer4)}")
											logger.warning(f"    → sfp_spider needs scan type 'all' (active scanning)")
											logger.warning(f"    → sfp_shodan needs API key configured in SpiderFoot")
											logger.warning(f"    → sfp_portscan_tcp needs scan type 'all' (active scanning)")
										
										logger.warning("Troubleshooting steps:")
										logger.warning("  1. Verify scan type is 'all' (not 'passive') - current: " + effective_scan_type)
										logger.warning("  2. Check SpiderFoot logs: %USERPROFILE%\\.spiderfoot\\logs\\spiderfoot.debug.log")
										logger.warning("  3. Increase scan timeout (current: " + str(timeout) + "s)")
										logger.warning("  4. Verify API keys in SpiderFoot Settings (Shodan, etc.)")
										logger.warning("  5. Install required tools (Wappalyzer for sfp_wappalyzer)")
					except Exception as timeout_error:
						logger.error(f"Failed to get final results: {timeout_error}")
					
					# Ensure entities_found is initialized
					if 'entities_found' not in locals() or not entities_found:
						entities_found = []
						modules_run = 0
						data_points = 0
						logger.warning("No entities found in scan results")
				else:
					error_msg = f"SpiderFoot API returned status {response.status_code}: {response.text[:200]}"
					logger.error(error_msg)
					raise Exception(error_msg)
					
					# Export to CSV if requested
					csv_file_path = None
					if output_format.lower() == 'csv' and entities_found:
						try:
							import csv
							# Get the api directory (where tasks.py is located)
							api_dir = os.path.dirname(__file__)
							exports_dir = os.path.join(api_dir, 'exports')
							os.makedirs(exports_dir, exist_ok=True)
							
							csv_filename = f"spiderfoot_{scan_id}_{target.replace('.', '_')}.csv"
							csv_file_path = os.path.join(exports_dir, csv_filename)
							
							with open(csv_file_path, 'w', newline='', encoding='utf-8') as csvfile:
								fieldnames = ['type', 'value', 'module', 'scan_id', 'target', 'timestamp']
								writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
								writer.writeheader()
								
								for entity in entities_found:
									writer.writerow({
										'type': entity.get('type', ''),
										'value': entity.get('value', ''),
										'module': entity.get('module', ''),
										'scan_id': scan_id,
										'target': target,
										'timestamp': datetime.utcnow().isoformat()
									})
							
							logger.info(f"CSV export saved to: {csv_file_path}")
						except Exception as csv_error:
							logger.warning(f"Failed to export CSV: {csv_error}")
							csv_file_path = None
					
					# Process results for ASM dashboard
					try:
						# Ensure path is set before importing
						if _current_dir not in sys.path:
							sys.path.insert(0, _current_dir)
						from services.spiderfoot_processor import process_scan_results
						raw_result = {
							'scan_id': scan_id,
							'target': target,
							'target_type': target_type,
							'entities': entities_found,
							'data_points': data_points,
							'modules_run': modules_run
						}
						processed_result = process_scan_results(raw_result)
						result = {
							**raw_result,
							'processed': processed_result
						}
					except Exception as process_error:
						logger.warning(f"Failed to process scan results: {process_error}")
						result = {
							'scan_id': scan_id,
							'target': target,
							'target_type': target_type,
							'entities': entities_found,
							'data_points': data_points,
							'modules_run': modules_run
						}
					
					if csv_file_path:
						result['csv_file'] = csv_file_path
						result['csv_filename'] = os.path.basename(csv_file_path)
					
					# Mark that SpiderFoot API succeeded
					spiderfoot_success = True
					return result
			except Exception as api_error:
				logger.error(f"❌ SpiderFoot API error: {api_error}", exc_info=True)
				# Check if we got entities before the error - if so, return them
				# entities_found is function-scoped, so we can always check it
				if entities_found and len(entities_found) > 0:
					logger.warning(f"SpiderFoot API had error but we have {len(entities_found)} entities. Returning them.")
					try:
						# Ensure path is set before importing
						if _current_dir not in sys.path:
							sys.path.insert(0, _current_dir)
						from services.spiderfoot_processor import process_scan_results
						raw_result = {
							'scan_id': scan_id,
							'target': target,
							'target_type': target_type,
							'entities': entities_found,
							'data_points': len(entities_found),
							'modules_run': modules_run
						}
						processed_result = process_scan_results(raw_result)
						result = {
							**raw_result,
							'processed': processed_result,
							'warning': f'Scan completed with some errors, but {len(entities_found)} entities were found.'
						}
						return result
					except Exception as process_error:
						logger.warning(f"Failed to process results: {process_error}")
						result = {
							'scan_id': scan_id,
							'target': target,
							'target_type': target_type,
							'entities': entities_found,
							'data_points': len(entities_found),
							'modules_run': modules_run,
							'warning': f'Scan completed with some errors, but {len(entities_found)} entities were found.'
						}
						return result
				logger.warning(f"SpiderFoot API not available: {api_error}, using alternative methods")
		
		# Fallback: Use alternative agentless methods for external surface scanning
		# ONLY use fallback if SpiderFoot API completely failed and we have NO entities
		# NOTE: This fallback only provides Layer 1 (basic discovery) results
		# For full Layer 2-4 results (technology, cloud, secrets), SpiderFoot API is required
		# Check if we have entities (even if spiderfoot_success is False, we might have partial results)
		has_entities = entities_found and len(entities_found) > 0
		if not spiderfoot_success and not has_entities:
			if not spiderfoot_api_url:
				logger.warning("SpiderFoot API URL not configured - using fallback methods (Layer 1 only)")
				logger.info("Set SPIDERFOOT_API_URL=http://localhost:5001 in your .env file to use SpiderFoot API")
			else:
				logger.warning("SpiderFoot API connection failed - using fallback methods (Layer 1 only)")
				logger.info(f"Verify SpiderFoot is running at {spiderfoot_api_url}")
				logger.info("For full ASM capabilities (Layers 2-4), ensure SpiderFoot is running and accessible")
			
			# Use subdomain enumeration (similar to SpiderFoot's passive modules)
			# Import passive_scan task directly to avoid circular imports
			try:
				# Call the passive_scan task directly
				passive_result = passive_scan.apply(args=[target])
				if passive_result.successful():
					subdomains = passive_result.result.get('subdomains', [target])
					host_to_ip = passive_result.result.get('host_to_ip', {})
					
					# Convert to SpiderFoot-like entities
					# Apply scan_depth limit to control how deep we go
					# NOTE: Fallback only provides Layer 1 (basic discovery) - no technology, cloud, or content data
					entities_found = []
					processed_count = 0
					max_depth_items = min(len(subdomains), scan_depth * 10)  # Limit based on depth
					
					for subdomain in subdomains[:max_depth_items]:
						entities_found.append({
							'type': 'INTERNET_NAME',
							'value': subdomain,
							'module': 'sfp_subdomain'
						})
						
						if subdomain in host_to_ip:
							entities_found.append({
								'type': 'IP_ADDRESS',
								'value': host_to_ip[subdomain],
								'module': 'sfp_dnsresolve'
							})
						processed_count += 1
						
						# Stop if we've reached the depth limit
						if processed_count >= max_depth_items:
							break
					
					data_points = len(entities_found)
					modules_run = len(modules) if modules else 5
					
					logger.info(f"Alternative scan completed: {data_points} entities found (depth: {scan_depth})")
					logger.warning("Fallback scan only provides Layer 1 (basic discovery). For Layers 2-4, use SpiderFoot API.")
			except Exception as e:
				logger.error(f"Alternative scan failed: {e}")
				return {
					'scan_id': scan_id,
					'target': target,
					'entities': [],
					'data_points': 0,
					'modules_run': 0,
					'error': str(e)
				}
		
		# Export to CSV if requested
		if output_format.lower() == 'csv' and entities_found:
			try:
				import csv
				# Get the api directory (where tasks.py is located)
				api_dir = os.path.dirname(__file__)
				exports_dir = os.path.join(api_dir, 'exports')
				os.makedirs(exports_dir, exist_ok=True)
				
				csv_filename = f"spiderfoot_{scan_id}_{target.replace('.', '_')}.csv"
				csv_file_path = os.path.join(exports_dir, csv_filename)
				
				with open(csv_file_path, 'w', newline='', encoding='utf-8') as csvfile:
					fieldnames = ['type', 'value', 'module', 'scan_id', 'target', 'timestamp']
					writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
					writer.writeheader()
					
					for entity in entities_found:
						writer.writerow({
							'type': entity.get('type', ''),
							'value': entity.get('value', ''),
							'module': entity.get('module', ''),
							'scan_id': scan_id,
							'target': target,
							'timestamp': datetime.utcnow().isoformat()
						})
				
				logger.info(f"CSV export saved to: {csv_file_path}")
			except Exception as csv_error:
				logger.warning(f"Failed to export CSV: {csv_error}")
				csv_file_path = None
		else:
			csv_file_path = None
		
		# Ensure entities_found is initialized
		if 'entities_found' not in locals() or not entities_found:
			entities_found = []
			data_points = 0
			modules_run = 0
		
		# Process results for ASM dashboard
		try:
			# Ensure path is set before importing
			if _current_dir not in sys.path:
				sys.path.insert(0, _current_dir)
			from services.spiderfoot_processor import process_scan_results
			raw_result = {
				'scan_id': scan_id,
				'target': target,
				'target_type': target_type,
				'entities': entities_found,
				'data_points': data_points,
				'modules_run': modules_run
			}
			processed_result = process_scan_results(raw_result)
			result = {
				**raw_result,
				'processed': processed_result
			}
		except Exception as process_error:
			logger.warning(f"Failed to process scan results: {process_error}")
			result = {
				'scan_id': scan_id,
				'target': target,
				'target_type': target_type,
				'entities': entities_found,
				'data_points': data_points,
				'modules_run': modules_run
			}
		
		if csv_file_path:
			result['csv_file'] = csv_file_path
			result['csv_filename'] = os.path.basename(csv_file_path)
		
		return result
		
	except Exception as e:
		logger.error(f"SpiderFoot scan failed: {e}", exc_info=True)
		return {
			'scan_id': scan_id,
			'target': target,
			'entities': [],
			'data_points': 0,
			'modules_run': 0,
			'error': str(e)
		}

@celery_app.task(name='scan.orchestrate', bind=True)
def orchestrate_scan(self, scan_id: str, domain: str, nessus_policy_uuid: str = None, 
                     enable_passive: bool = True, enable_active: bool = True, 
                     enable_vuln: bool = True, port_range: str = None,
                     scan_intensity: str = "normal", max_threads: int = 10,
                     timeout: int = 3600) -> Dict[str, Any]:
	"""
	Main orchestration: passive -> active -> vulnerability -> index.
	Enforces timeout and returns partial results if timeout is reached.
	"""
	import time
	scan_start_time = time.time()
	max_wait = int(timeout)
	timed_out = False
	
	logger.info(f"Starting orchestrated scan {scan_id} for {domain} (timeout: {max_wait}s)")
	
	# Helper function to check timeout
	def check_timeout():
		elapsed = time.time() - scan_start_time
		if elapsed >= max_wait:
			return True, elapsed
		return False, elapsed
	
	# Step 1: Passive reconnaissance
	subdomains = [domain]
	host_to_ip = {}
	
	if enable_passive:
		# Check timeout before starting
		timed_out, elapsed = check_timeout()
		if timed_out:
			logger.warning(f"Timeout reached ({max_wait}s) before passive scan. Returning partial results.")
			return {
				'scan_id': scan_id,
				'domain': domain,
				'subdomains': subdomains,
				'services': [],
				'vulnerabilities': [],
				'assets_found': 0,
				'services_found': 0,
				'vulnerabilities_found': 0,
				'timed_out': True,
				'elapsed_time': elapsed,
				'warning': f'Scan timed out after {max_wait}s. Partial results returned.'
			}
		
		try:
			# Use apply() instead of delay().get() to execute synchronously in same worker
			passive_result = passive_scan.apply(args=[domain])
			if passive_result.successful():
				subdomains = passive_result.result.get('subdomains', [domain])
				host_to_ip = passive_result.result.get('host_to_ip', {})
				logger.info(f"Passive scan found {len(subdomains)} subdomains")
			else:
				logger.error(f"Passive scan failed: {passive_result.result}")
		except Exception as e:
			logger.error(f"Passive scan failed: {e}")
	
	# Step 2: Active scanning
	services = []
	if enable_active and subdomains:
		# Check timeout before starting active scan
		timed_out, elapsed = check_timeout()
		if timed_out:
			logger.warning(f"Timeout reached ({max_wait}s) before active scan. Returning partial results.")
			# Return partial results with subdomains found
			return {
				'scan_id': scan_id,
				'domain': domain,
				'subdomains': subdomains,
				'services': [],
				'vulnerabilities': [],
				'assets_found': len(subdomains),
				'services_found': 0,
				'vulnerabilities_found': 0,
				'timed_out': True,
				'elapsed_time': elapsed,
				'warning': f'Scan timed out after {max_wait}s. Passive scan completed, active scan not started.'
			}
		
		try:
			# Calculate remaining time for active scan
			elapsed = time.time() - scan_start_time
			remaining_time = max(60, max_wait - elapsed - 60)  # Reserve 60s for vulnerability scan and indexing
			
			# Use apply() instead of delay().get() to execute synchronously in same worker
			active_result = active_scan.apply(args=[subdomains], kwargs={
				'host_to_ip': host_to_ip,
				'port_range': port_range,
				'scan_intensity': scan_intensity,
				'max_threads': max_threads,
				'timeout': int(remaining_time)
			})
			if active_result.successful():
				services = active_result.result or []
				logger.info(f"Active scan found {len(services)} services")
			else:
				logger.error(f"Active scan failed: {active_result.result}")
		except Exception as e:
			logger.error(f"Active scan failed: {e}")
		
		# Check timeout after active scan
		timed_out, elapsed = check_timeout()
		if timed_out:
			logger.warning(f"Timeout reached ({max_wait}s) after active scan. Returning partial results.")
			# Return partial results with what we have so far
			return {
				'scan_id': scan_id,
				'domain': domain,
				'subdomains': subdomains,
				'services': services,
				'vulnerabilities': [],
				'assets_found': len(subdomains),
				'services_found': len(services),
				'vulnerabilities_found': 0,
				'timed_out': True,
				'elapsed_time': elapsed,
				'warning': f'Scan timed out after {max_wait}s. Active scan completed, vulnerability scan not started.'
			}
	
	# Step 3: Vulnerability scanning
	vuln_findings = []
	if enable_vuln and subdomains:
		# Check timeout before starting vulnerability scan
		timed_out, elapsed = check_timeout()
		if timed_out:
			logger.warning(f"Timeout reached ({max_wait}s) before vulnerability scan. Returning partial results.")
			# Return partial results with what we have so far
			return {
				'scan_id': scan_id,
				'domain': domain,
				'subdomains': subdomains,
				'services': services,
				'vulnerabilities': [],
				'assets_found': len(subdomains),
				'services_found': len(services),
				'vulnerabilities_found': 0,
				'timed_out': True,
				'elapsed_time': elapsed,
				'warning': f'Scan timed out after {max_wait}s. Vulnerability scan not started.'
			}
		# Vulnerability scanning removed - Nessus integration disabled
	
	# Step 4: Index results
	documents = []
	
	# Group services by hostname
	services_by_host = {}
	for svc in services:
		hostname = svc.get('hostname', domain)
		if hostname not in services_by_host:
			services_by_host[hostname] = []
		services_by_host[hostname].append({
			'port': svc.get('port'),
			'protocol': svc.get('protocol', 'tcp'),
			'name': svc.get('name', 'unknown'),
			'version': svc.get('version', 'unknown')
		})
	
	# Group vulnerabilities by host
	vulns_by_host = {}
	for vuln in vuln_findings:
		vuln_host = vuln.get('host', domain)
		if vuln_host not in vulns_by_host:
			vulns_by_host[vuln_host] = []
		vulns_by_host[vuln_host].append({
			'plugin_id': vuln.get('plugin_id'),
			'name': vuln.get('name'),
			'severity': vuln.get('severity'),
			'cvss_score': vuln.get('cvss_score', 0.0),
			'cve': vuln.get('cve', '')
		})
	
	# Create documents per host
	for hostname, svc_list in services_by_host.items():
		doc = {
			'@timestamp': datetime.utcnow().isoformat(),
			'scan_id': scan_id,
			'asset': {
				'domain': domain,
				'hostname': hostname,
				'ip': host_to_ip.get(hostname) or services[0].get('ip', '') if services else ''
			},
			'services': svc_list,
			'vulnerabilities': vulns_by_host.get(hostname, [])
		}
		documents.append(doc)
	
	# If no services found, create a placeholder document for each subdomain
	if not documents:
		for hostname in subdomains[:10]:  # Limit to first 10 to avoid too many documents
			doc = {
				'@timestamp': datetime.utcnow().isoformat(),
				'scan_id': scan_id,
				'asset': {
					'domain': domain,
					'hostname': hostname,
					'ip': host_to_ip.get(hostname, '')
				},
				'services': [],
				'vulnerabilities': vulns_by_host.get(hostname, [])
			}
			documents.append(doc)
	
	# Bulk index (non-blocking, don't fail if indexing fails)
	try:
		bulk_index_assets(documents)
	except Exception as e:
		logger.error(f"Indexing failed: {e} (non-critical)")
		# Don't raise - indexing is optional
	
	elapsed_time = time.time() - scan_start_time
	logger.info(f"Scan {scan_id} completed in {elapsed_time:.1f}s: {len(documents)} assets, {len(services)} services, {len(vuln_findings)} vulnerabilities")
	
	# Normalize Nessus vulnerability findings for consistent frontend display
	normalized_vulns = []
	for vuln in vuln_findings:
		# Ensure severity_name is set (convert severity number to name if needed)
		severity_num = vuln.get('severity', '0')
		if isinstance(severity_num, str):
			try:
				severity_num = int(severity_num)
			except:
				severity_num = 0
		
		severity_name = vuln.get('severity_name')
		if not severity_name:
			severity_map = {0: 'Info', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical'}
			severity_name = severity_map.get(int(severity_num), 'Unknown')
		
		normalized_vuln = {
			'plugin_id': vuln.get('plugin_id', ''),
			'name': vuln.get('name', 'Unknown'),
			'severity': str(severity_num),  # Keep original for reference
			'severity_name': severity_name,  # Use this for display
			'cvss_score': float(vuln.get('cvss_score', 0.0)),
			'cve': vuln.get('cve', ''),
			'host': vuln.get('host', domain),
			'description': vuln.get('description', '')
		}
		normalized_vulns.append(normalized_vuln)
	
	# Return detailed results
	result = {
		'scan_id': scan_id,
		'domain': domain,
		'subdomains': subdomains,
		'services': services,  # Include full service details
		'vulnerabilities': normalized_vulns,  # Include normalized vulnerability details
		'assets_found': len(documents),
		'services_found': len(services),
		'vulnerabilities_found': len(normalized_vulns),
		'host_to_ip': host_to_ip,
		'elapsed_time': elapsed_time,
		# Tool status indicators
		'tools_used': {
			'passive': enable_passive,
			'active': enable_active,
			'vulnerability': enable_vuln
		}
	}
	
	# Add information about Nessus status if it was skipped or had errors
	if enable_vuln:
		pass
	
	return result


# ==================== Data Leak Monitoring Tasks ====================

@celery_app.task(name='leak.scan_exposed_databases', bind=True)
def scan_exposed_databases_task(
	self, 
	scan_id: str, 
	domain: str = None, 
	org: str = None,
	db_types: List[str] = None,
	limit: int = 100
) -> Dict[str, Any]:
	"""
	Celery task for scanning exposed databases (LeakLooker style).
	Uses Shodan API to find exposed MongoDB, Elasticsearch, Redis, etc.
	"""
	import asyncio
	logger.info(f"Starting exposed database scan {scan_id} for {domain or org}")
	
	try:
		# Ensure path is set before importing
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.data_leak_monitor import data_leak_monitor, DatabaseType
		
		# Convert string db_types to enum if provided
		db_type_enums = None
		if db_types:
			db_type_enums = []
			for dt in db_types:
				try:
					db_type_enums.append(DatabaseType(dt.lower()))
				except ValueError:
					logger.warning(f"Unknown database type: {dt}")
		
		# Run async scan
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		results = loop.run_until_complete(
			data_leak_monitor.scan_exposed_databases(
				domain=domain,
				org=org,
				db_types=db_type_enums,
				limit=limit
			)
		)
		loop.close()
		
		# Convert results to dict
		from dataclasses import asdict
		findings = [asdict(r) for r in results]
		
		# Calculate severity summary
		severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
		for r in results:
			severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1
		
		logger.info(f"Exposed database scan {scan_id} completed: {len(findings)} findings")
		
		return {
			'scan_id': scan_id,
			'status': 'completed',
			'target': domain or org,
			'total_findings': len(findings),
			'severity_summary': severity_counts,
			'findings': findings,
			'completed_at': datetime.utcnow().isoformat()
		}
		
	except Exception as e:
		logger.error(f"Exposed database scan failed: {e}", exc_info=True)
		return {
			'scan_id': scan_id,
			'status': 'failed',
			'error': str(e),
			'findings': []
		}


@celery_app.task(name='leak.scan_repository_secrets', bind=True)
def scan_repository_secrets_task(
	self,
	scan_id: str,
	repo_url: str,
	branch: str = None,
	since_commit: str = None,
	max_depth: int = None
) -> Dict[str, Any]:
	"""
	Celery task for scanning git repositories for leaked secrets.
	Uses TruffleHog for detection.
	"""
	import asyncio
	logger.info(f"Starting repository secret scan {scan_id} for {repo_url}")
	
	try:
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.data_leak_monitor import data_leak_monitor
		
		# Update task state
		self.update_state(state='PROGRESS', meta={
			'scan_id': scan_id,
			'status': 'scanning',
			'message': 'Scanning repository for secrets...'
		})
		
		# Run async scan
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		results = loop.run_until_complete(
			data_leak_monitor.scan_repository_secrets(
				repo_url=repo_url,
				branch=branch,
				since_commit=since_commit,
				max_depth=max_depth
			)
		)
		loop.close()
		
		# Convert results
		from dataclasses import asdict
		findings = [asdict(r) for r in results]
		
		# Calculate summaries
		severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
		by_detector = {}
		for r in results:
			severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1
			detector = r.data.get('detector', 'unknown')
			by_detector[detector] = by_detector.get(detector, 0) + 1
		
		logger.info(f"Repository secret scan {scan_id} completed: {len(findings)} findings")
		
		return {
			'scan_id': scan_id,
			'status': 'completed',
			'repository': repo_url,
			'total_findings': len(findings),
			'severity_summary': severity_counts,
			'detector_summary': by_detector,
			'findings': findings,
			'completed_at': datetime.utcnow().isoformat()
		}
		
	except Exception as e:
		logger.error(f"Repository secret scan failed: {e}", exc_info=True)
		return {
			'scan_id': scan_id,
			'status': 'failed',
			'error': str(e),
			'findings': []
		}


@celery_app.task(name='leak.comprehensive_scan', bind=True)
def comprehensive_leak_scan_task(
	self,
	scan_id: str,
	domain: str = None,
	emails: List[str] = None,
	org: str = None,
	repo_urls: List[str] = None,
	include_db_scan: bool = True,
	include_secret_scan: bool = True
) -> Dict[str, Any]:
	"""
	Celery task for comprehensive data leak scanning.
	Combines email/domain breach checks, exposed database scanning, and secret detection.
	"""
	import asyncio
	logger.info(f"Starting comprehensive leak scan {scan_id}")
	
	try:
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.data_leak_monitor import data_leak_monitor
		
		# Update progress
		self.update_state(state='PROGRESS', meta={
			'scan_id': scan_id,
			'status': 'running',
			'message': 'Starting comprehensive scan...',
			'progress': 0
		})
		
		# Run comprehensive scan
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		results = loop.run_until_complete(
			data_leak_monitor.comprehensive_leak_scan(
				domain=domain,
				emails=emails,
				org=org,
				repo_urls=repo_urls,
				include_db_scan=include_db_scan,
				include_secret_scan=include_secret_scan
			)
		)
		loop.close()
		
		logger.info(f"Comprehensive leak scan {scan_id} completed: {results.get('summary', {}).get('total_findings', 0)} findings")
		
		return results
		
	except Exception as e:
		logger.error(f"Comprehensive leak scan failed: {e}", exc_info=True)
		return {
			'scan_id': scan_id,
			'status': 'failed',
			'error': str(e),
			'findings': [],
			'summary': {'total_findings': 0, 'error': str(e)}
		}


@celery_app.task(name='leak.scheduled_monitoring', bind=True)
def scheduled_leak_monitoring(self) -> Dict[str, Any]:
	"""
	Scheduled task for continuous leak monitoring.
	Runs periodically to check monitored assets for new leaks.
	
	Configure with Celery Beat:
	celery -A celery_app beat --loglevel=info
	"""
	import asyncio
	logger.info("Running scheduled leak monitoring")
	
	try:
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.data_leak_monitor import data_leak_monitor
		
		# Get monitoring configuration from database
		# In production, this would query the MonitoredAsset table
		# For now, we'll use environment variables as fallback
		
		monitored_domains = os.getenv('MONITORED_DOMAINS', '').split(',')
		monitored_emails = os.getenv('MONITORED_EMAILS', '').split(',')
		
		# Filter empty strings
		monitored_domains = [d.strip() for d in monitored_domains if d.strip()]
		monitored_emails = [e.strip() for e in monitored_emails if e.strip()]
		
		if not monitored_domains and not monitored_emails:
			logger.info("No monitored assets configured. Skipping scheduled scan.")
			return {'status': 'skipped', 'reason': 'No monitored assets configured'}
		
		results = {
			'scan_id': f"scheduled-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
			'started_at': datetime.utcnow().isoformat(),
			'domains_checked': len(monitored_domains),
			'emails_checked': len(monitored_emails),
			'new_findings': [],
			'errors': []
		}
		
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		
		# Check domains for breaches
		for domain in monitored_domains:
			try:
				breaches = loop.run_until_complete(
					data_leak_monitor.check_domain_breaches(domain)
				)
				for breach in breaches:
					results['new_findings'].append({
						'type': 'domain_breach',
						'target': domain,
						'breach': breach.name,
						'severity': 'high'
					})
			except Exception as e:
				results['errors'].append(f"Error checking {domain}: {str(e)}")
		
		# Check emails for breaches
		for email in monitored_emails:
			try:
				breaches = loop.run_until_complete(
					data_leak_monitor.check_email_breaches(email)
				)
				for breach in breaches:
					results['new_findings'].append({
						'type': 'email_breach',
						'target': email,
						'breach': breach.name,
						'severity': 'high'
					})
			except Exception as e:
				results['errors'].append(f"Error checking {email}: {str(e)}")
		
		loop.close()
		
		results['completed_at'] = datetime.utcnow().isoformat()
		results['total_new_findings'] = len(results['new_findings'])
		
		# If new findings, trigger alerts (in production)
		if results['new_findings']:
			logger.warning(f"Scheduled monitoring found {len(results['new_findings'])} new findings!")
			# TODO: Send alerts via webhook/email
		
		logger.info(f"Scheduled leak monitoring completed: {len(results['new_findings'])} new findings")
		return results
		
	except Exception as e:
		logger.error(f"Scheduled leak monitoring failed: {e}", exc_info=True)
		return {'status': 'failed', 'error': str(e)}


@celery_app.task(name='leak.check_email_batch', bind=True)
def check_email_batch_task(self, emails: List[str]) -> Dict[str, Any]:
	"""
	Celery task to check multiple emails for breaches in batch.
	Respects HIBP rate limits.
	"""
	import asyncio
	logger.info(f"Starting batch email breach check for {len(emails)} emails")
	
	try:
		if _current_dir not in sys.path:
			sys.path.insert(0, _current_dir)
		from services.data_leak_monitor import data_leak_monitor
		
		results = {
			'total_emails': len(emails),
			'emails_with_breaches': 0,
			'total_breaches': 0,
			'results': []
		}
		
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)
		
		for i, email in enumerate(emails):
			try:
				# Update progress
				self.update_state(state='PROGRESS', meta={
					'current': i + 1,
					'total': len(emails),
					'email': email
				})
				
				breaches = loop.run_until_complete(
					data_leak_monitor.check_email_breaches(email)
				)
				
				email_result = {
					'email': email,
					'breach_count': len(breaches),
					'breaches': [b.name for b in breaches]
				}
				results['results'].append(email_result)
				
				if breaches:
					results['emails_with_breaches'] += 1
					results['total_breaches'] += len(breaches)
					
			except Exception as e:
				results['results'].append({
					'email': email,
					'error': str(e)
				})
		
		loop.close()
		
		logger.info(f"Batch email check completed: {results['emails_with_breaches']}/{len(emails)} have breaches")
		return results
		
	except Exception as e:
		logger.error(f"Batch email check failed: {e}", exc_info=True)
		return {'status': 'failed', 'error': str(e)}



