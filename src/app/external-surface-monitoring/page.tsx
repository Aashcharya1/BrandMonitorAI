"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Globe, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  BarChart3,
  Network,
  Zap,
  Shield,
  Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScanConfig {
  target: string;
  targetType: string;  // domain, ip, asn, netblock
  scanType: string;
  modules: string[];
  scanDepth: number;
  scanTimeout: number;
  maxThreads: number;
}

export default function ExternalSurfaceMonitoringPage() {
  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState("domain");
  const [scanType, setScanType] = useState("mvp");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [scanDepth, setScanDepth] = useState(5); // Average/Best case default
  const [scanTimeout, setScanTimeout] = useState(3600); // 1 hour default
  const [maxThreads, setMaxThreads] = useState(10);
  const [currentConfig, setCurrentConfig] = useState<ScanConfig | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const availableModules = [
    // Phase 1: Discovery (Layer 1) - CRITICAL
    "sfp_crt",              // Certificate Transparency - CRITICAL (finds hidden subdomains)
    "sfp_subdomain",        // General subdomain enumeration
    "sfp_dnsresolve",       // DNS resolution - CRITICAL (maps domains to IPs)
    // Phase 2: Resolution & Ownership (Layer 1 Advanced) - CRITICAL
    "sfp_whois",            // WHOIS lookups - CRITICAL (finds netblocks, ASN owners)
    "sfp_dnsbrute",         // DNS brute forcing
    "sfp_dnscommonsrv",     // DNS common SRV records
    "sfp_dnsdb",            // DNS database lookups
    // Phase 3: Technology Stack (Layer 2) - CRITICAL for MVP
    "sfp_wappalyzer",       // Tech stack identification - CRITICAL (React, Django, WordPress)
    "sfp_httpheader",       // Server banners - CRITICAL (nginx, gunicorn versions)
    // Phase 4: Cloud & Storage (Layer 3) - CRITICAL for security
    "sfp_s3bucket",         // AWS S3 bucket discovery - CRITICAL (finds open buckets)
    "sfp_azureblobstorage", // Azure blob discovery - CRITICAL
    "sfp_googleobjectstorage", // GCP bucket discovery - CRITICAL
    // Phase 5: Content & Secrets (Layer 4) - Active scanning required
    "sfp_spider",           // Web crawling - CRITICAL (finds emails, forms, internal links)
    "sfp_shodan",           // Open ports/banners - CRITICAL (requires API key, no noisy port scan)
    // Additional modules
    "sfp_hackertarget",     // HackerTarget API
    "sfp_threatcrowd",      // ThreatCrowd API
    "sfp_virustotal",       // VirusTotal API (requires key)
    "sfp_securitytrails",   // SecurityTrails API (requires key)
    "sfp_censys",           // Censys API (requires key)
    "sfp_webanalyze",       // Web analysis
    "sfp_ssl",              // SSL certificate analysis
    "sfp_certificate",      // Certificate parsing
    "sfp_portscan_tcp",     // TCP port scanning (active)
  ];

  useEffect(() => {
    if (!jobId) return;
    
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/external-surface/status/${jobId}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.detail || errorData.error || `HTTP ${res.status}`;
          setError(errorMsg);
          if (res.status === 404) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
          }
          return;
        }
        const data = await res.json();
        setStatus(data.status || null);
        
        // Handle scan completion
        if (data.status === "finished") {
          setScanResult(data); // Store entire response including result
          // Only show error if scan truly failed (no results)
          if (data.result && (data.result.entities_found > 0 || data.result.data_points > 0)) {
            // Scan succeeded with results - clear any errors
            setError(null);
          } else if (data.error && (!data.result || data.result.entities_found === 0)) {
            // Only show error if there are no results
            setError(data.error);
          } else {
            setError(null);
          }
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (data.error) {
          // Show error for non-finished scans
          setError(data.error);
        } else {
          setError(null);
        }
        if (data.warning) {
          setWarning(data.warning);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  // Helper function to convert entity type codes to user-friendly names
  const getEntityTypeDisplayName = (type: string): string => {
    const typeMap: Record<string, string> = {
      'FD_URL_INTERNAL': 'Internal URLs',
      'LINKED_URL_INTERNAL': 'Internal Links',
      'HTTP_CODE': 'HTTP Status Codes',
      'R_CONTENT_TYPE': 'Content Types',
      'FR_HTTPHEADERS': 'HTTP Headers',
      'T_WEB_CONTENT': 'Web Content',
      'D_URL_EXTERNAL': 'External URLs',
      'LINKED_URL_EXTERNAL': 'External Links',
      'INTERNET_NAME': 'Internet Names',
      'IP_ADDRESS': 'IP Addresses',
      'DOMAIN_NAME': 'Domain Names',
      'DOMAIN_WHOIS': 'WHOIS Records',
      'TCP_PORT_OPEN': 'Open TCP Ports',
      'UDP_PORT_OPEN': 'Open UDP Ports',
      'SOFTWARE_USED': 'Software Detected',
      'WEBSERVER_BANNER': 'Web Server Banners',
      'TECHNOLOGY': 'Technologies',
      'CLOUD_STORAGE_BUCKET': 'Cloud Storage Buckets',
      'CLOUD_STORAGE_BUCKET_OPEN': 'Open Cloud Buckets',
      'EMAIL_ADDRESS': 'Email Addresses',
      'FORM_NAME': 'Form Names',
      'WEBSERVER_HTTPHEADERS': 'Web Server Headers',
      'TARGET_WEB_CONTENT': 'Target Web Content',
      'TARGET_WEB_CONTENT_TYPE': 'Web Content Types',
    };
    // Convert technical codes to readable format
    const normalized = type.toUpperCase();
    if (typeMap[normalized]) {
      return typeMap[normalized];
    }
    // Fallback: convert underscores to spaces and title case
    return normalized
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to convert module names to user-friendly display names
  const getModuleDisplayName = (module: string): string => {
    const moduleMap: Record<string, string> = {
      'sfp_crt': 'Certificate Transparency',
      'sfp_subdomain': 'Subdomain Discovery',
      'sfp_dnsresolve': 'DNS Resolution',
      'sfp_whois': 'WHOIS Lookup',
      'sfp_dnsbrute': 'DNS Brute Force',
      'sfp_dnscommonsrv': 'DNS Common Services',
      'sfp_dnsdb': 'DNS Database',
      'sfp_wappalyzer': 'Technology Stack',
      'sfp_httpheader': 'HTTP Headers',
      'sfp_s3bucket': 'AWS S3 Buckets',
      'sfp_azureblobstorage': 'Azure Storage',
      'sfp_googleobjectstorage': 'GCP Buckets',
      'sfp_spider': 'Web Crawling',
      'sfp_shodan': 'Port Discovery',
      'sfp_hackertarget': 'HackerTarget',
      'sfp_threatcrowd': 'ThreatCrowd',
      'sfp_virustotal': 'VirusTotal',
      'sfp_securitytrails': 'SecurityTrails',
      'sfp_censys': 'Censys',
      'sfp_webanalyze': 'Web Analysis',
      'sfp_ssl': 'SSL Analysis',
      'sfp_certificate': 'Certificate Parsing',
      'sfp_portscan_tcp': 'Port Scanning',
      'SpiderFoot UI': 'System Discovery',
      'spiderfoot ui': 'System Discovery',
    };
    return moduleMap[module] || module.replace('sfp_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleStartScan = async (config: ScanConfig) => {
    // Clear polling interval if active (from previous scan)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setCurrentConfig(config);
    setJobId(null);
    setStatus(null);
    setError(null);
    setWarning(null);
    setResultUrl(null);
    setScanResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/external-surface/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: config.target,
          target_type: config.targetType,
          scan_type: config.scanType,
          modules: config.modules.length > 0 ? config.modules : availableModules,
          scan_depth: config.scanDepth,
          timeout: config.scanTimeout,
          output_format: "json", // Always use JSON
          max_threads: config.maxThreads,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.job_id);
      setStatus("queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan");
    }
  };

  const handleNewScan = async () => {
    // Clear polling interval if active (stop checking status of current scan)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Abort ALL ongoing SpiderFoot scans first (this ensures all scans in SpiderFoot are stopped)
    try {
      const abortRes = await fetch(`${API_BASE}/api/v1/external-surface/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (abortRes.ok) {
        const abortData = await abortRes.json();
        if (abortData.aborted_count > 0) {
          console.log(`✅ Aborted ${abortData.aborted_count} ongoing scan(s) in SpiderFoot`);
          // Optionally show a brief notification to user
          setWarning(`Aborted ${abortData.aborted_count} ongoing scan(s)`);
          // Clear warning after 3 seconds
          setTimeout(() => setWarning(null), 3000);
        }
      } else {
        console.warn("Failed to abort scans:", abortRes.status);
      }
    } catch (err) {
      // Log error but don't block the reset
      console.warn("Failed to abort ongoing scans:", err);
    }
    
    // Reset all state
    setTarget("");
    setTargetType("domain");
    setScanType("mvp");
    setSelectedModules([]);
    setScanDepth(5); // Reset to average/best case
    setScanTimeout(3600); // Reset to 1 hour
    setMaxThreads(10);
    setCurrentConfig(null);
    setStatus(null);
    setError(null);
    setWarning(null);
    setResultUrl(null);
    setJobId(null);
    setScanResult(null);
  };

  const toggleModule = (module: string) => {
    setSelectedModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "text-muted-foreground";
    if (status === "finished") return "text-green-600";
    if (status === "failed") return "text-red-600";
    if (status === "running") return "text-blue-600";
    return "text-yellow-600";
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return null;
    if (status === "finished") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (status === "failed") return <XCircle className="h-5 w-5 text-red-600" />;
    if (status === "running" || status === "queued") return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    return <Globe className="h-5 w-5 text-yellow-600" />;
  };

  const getProgressValue = (status: string | null) => {
    if (status === "finished") return 100;
    if (status === "running") return 50;
    if (status === "queued") return 10;
    return 0;
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-0 md:p-0 h-full">
        {/* Header with Actions */}
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6" />
              External Surface Monitoring
            </h1>
            {currentConfig && (
              <p className="text-sm text-muted-foreground mt-1">
                Scanning: <span className="font-mono font-medium">{currentConfig.target}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNewScan}>
              <RefreshCw className="h-4 w-4 mr-2" />
              New Scan
            </Button>
          </div>
        </div>

        {/* Scan Status Card */}
        {(jobId || status) && (
          <div className="px-6">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      Scan Status
                    </div>
                    {status && (
                      <span className={`text-sm font-normal ${getStatusColor(status)}`}>
                        {getProgressValue(status)}%
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {error && status !== "finished" && (
                    <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show error only if scan finished with no results */}
                  {error && status === "finished" && (!scanResult?.result || scanResult.result.entities_found === 0) && (
                    <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {status && !error && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="capitalize font-medium">{status}</span>
                      </div>
                      <Progress value={getProgressValue(status)} className="h-2" />
                    </div>
                  )}

                  {currentConfig && (
                    <div className="p-5 border rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Scan Configuration</p>
                        <Badge variant="secondary" className="text-xs">
                          {currentConfig.target}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                          {currentConfig.scanType}
                        </Badge>
                        {currentConfig.modules.map((mod) => (
                          <Badge key={mod} variant="outline" className="text-xs">
                            {mod}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {scanResult && scanResult.result && (
                    <div className="space-y-6">
                      {/* Critical Alerts */}
                      {scanResult.result.processed?.alerts && scanResult.result.processed.alerts.length > 0 && (
                        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                              <Shield className="h-5 w-5" />
                              Critical Findings ({scanResult.result.processed.alerts.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {scanResult.result.processed.alerts.map((alert: any, idx: number) => (
                                <div key={idx} className="p-3 bg-white dark:bg-gray-900 rounded border border-red-200 dark:border-red-800">
                                  <p className="text-sm font-medium text-red-900 dark:text-red-100">{alert.message}</p>
                                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">Category: {alert.category}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Categorized Summary */}
                      {scanResult.result.processed?.categorized && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Infrastructure</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-2xl font-bold">{scanResult.result.processed.categorized.summary?.infrastructure_count || 0}</p>
                              <p className="text-xs text-muted-foreground">IPs, Domains, Ports</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Cloud Storage</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-2xl font-bold">{scanResult.result.processed.categorized.summary?.cloud_storage_count || 0}</p>
                              <p className="text-xs text-muted-foreground">S3, Azure, GCP</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Web Apps</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-2xl font-bold">{scanResult.result.processed.categorized.summary?.web_applications_count || 0}</p>
                              <p className="text-xs text-muted-foreground">Tech Stack, Banners</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">Leaks & Risks</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-2xl font-bold">{scanResult.result.processed.categorized.summary?.leaks_risks_count || 0}</p>
                              <p className="text-xs text-muted-foreground">Emails, Secrets</p>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Summary Statistics */}
                      <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{scanResult.result.entities_found || 0}</p>
                          <p className="text-xs text-muted-foreground">Entities</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{scanResult.result.data_points || 0}</p>
                          <p className="text-xs text-muted-foreground">Data Points</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{scanResult.result.modules_run || 0}</p>
                          <p className="text-xs text-muted-foreground">Modules Run</p>
                        </div>
                      </div>

                      {/* Debug: Entity Types by Layer */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (() => {
                        const entityTypeCounts: Record<string, number> = {};
                        const moduleTypeCounts: Record<string, Record<string, number>> = {};
                        scanResult.result.entities.forEach((entity: any) => {
                          const type = (entity.type || 'UNKNOWN').toUpperCase();
                          entityTypeCounts[type] = (entityTypeCounts[type] || 0) + 1;
                          const module = entity.module || 'unknown';
                          if (!moduleTypeCounts[module]) {
                            moduleTypeCounts[module] = {};
                          }
                          moduleTypeCounts[module][type] = (moduleTypeCounts[module][type] || 0) + 1;
                        });
                        
                        // Categorize by layer
                        const layer1Types = ['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER'];
                        const layer2Types = ['SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE'];
                        const layer3Types = ['CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY'];
                        const layer4Types = ['EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL', 'UDP_PORT_OPEN'];
                        
                        const layer1Count = Object.keys(entityTypeCounts).filter(t => layer1Types.includes(t)).reduce((sum, t) => sum + entityTypeCounts[t], 0);
                        const layer2Count = Object.keys(entityTypeCounts).filter(t => layer2Types.includes(t)).reduce((sum, t) => sum + entityTypeCounts[t], 0);
                        const layer3Count = Object.keys(entityTypeCounts).filter(t => layer3Types.includes(t)).reduce((sum, t) => sum + entityTypeCounts[t], 0);
                        const layer4Count = Object.keys(entityTypeCounts).filter(t => layer4Types.includes(t)).reduce((sum, t) => sum + entityTypeCounts[t], 0);
                        
                        return (
                          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
                            <CardHeader>
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Debug: Entity Types by Layer
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div className="p-2 bg-white dark:bg-gray-900 rounded">
                                    <div className="font-semibold">Layer 1</div>
                                    <div className="text-lg font-bold text-blue-600">{layer1Count}</div>
                                    <div className="text-muted-foreground">Infrastructure</div>
                                  </div>
                                  <div className="p-2 bg-white dark:bg-gray-900 rounded">
                                    <div className="font-semibold">Layer 2</div>
                                    <div className="text-lg font-bold text-green-600">{layer2Count}</div>
                                    <div className="text-muted-foreground">Technology</div>
                                  </div>
                                  <div className="p-2 bg-white dark:bg-gray-900 rounded">
                                    <div className="font-semibold">Layer 3</div>
                                    <div className="text-lg font-bold text-orange-600">{layer3Count}</div>
                                    <div className="text-muted-foreground">Cloud Storage</div>
                                  </div>
                                  <div className="p-2 bg-white dark:bg-gray-900 rounded">
                                    <div className="font-semibold">Layer 4</div>
                                    <div className="text-lg font-bold text-purple-600">{layer4Count}</div>
                                    <div className="text-muted-foreground">Content & Secrets</div>
                                  </div>
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="font-semibold">All Entity Types Found ({Object.keys(entityTypeCounts).length} types):</div>
                                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                    {Object.entries(entityTypeCounts)
                                      .sort((a, b) => b[1] - a[1])
                                      .map(([type, count]) => (
                                        <Badge key={type} variant="outline" className="text-xs">
                                          {type}: {count}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="font-semibold">Modules Producing Output ({Object.keys(moduleTypeCounts).length} modules):</div>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                    {Object.entries(moduleTypeCounts)
                                      .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
                                      .map(([module, types]) => {
                                        const total = Object.values(types).reduce((s, v) => s + v, 0);
                                        return (
                                          <Badge key={module} variant="secondary" className="text-xs">
                                            {getModuleDisplayName(module)}: {total}
                                          </Badge>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {/* Entity Type Distribution Chart */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (() => {
                        const entityTypeCounts: Record<string, number> = {};
                        scanResult.result.entities.forEach((entity: any) => {
                          const type = (entity.type || 'UNKNOWN').toUpperCase();
                          entityTypeCounts[type] = (entityTypeCounts[type] || 0) + 1;
                        });
                        
                        const totalEntities = Object.values(entityTypeCounts).reduce((sum, count) => sum + count, 0);
                        const sortedTypes = Object.entries(entityTypeCounts)
                          .map(([type, count]) => ({
                            type,
                            displayName: getEntityTypeDisplayName(type),
                            count,
                            percentage: ((count / totalEntities) * 100).toFixed(1)
                          }))
                          .sort((a, b) => b.count - a.count);
                        
                        // Show top 8 types, group the rest as "Others"
                        const topN = 8;
                        const topTypes = sortedTypes.slice(0, topN);
                        const remainingTypes = sortedTypes.slice(topN);
                        const othersTotal = remainingTypes.reduce((sum, t) => sum + t.count, 0);
                        const othersPercentage = ((othersTotal / totalEntities) * 100).toFixed(1);
                        
                        let chartData = topTypes.map(t => ({
                          name: t.displayName,
                          count: t.count,
                          percentage: t.percentage,
                          originalType: t.type
                        }));
                        
                        if (remainingTypes.length > 0 && othersTotal > 0) {
                          chartData.push({
                            name: `Others (${remainingTypes.length} types)`,
                            count: othersTotal,
                            percentage: othersPercentage,
                            originalType: 'OTHERS'
                          });
                        }

                        // Custom tooltip component
                        const CustomTooltip = ({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                                <p className="font-semibold text-sm mb-1">{data.name}</p>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{data.count.toLocaleString()}</span> entities
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {data.percentage}% of total
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        };

                        // Gradient colors for bars
                        const getBarColor = (index: number, total: number) => {
                          const colors = [
                            'hsl(217, 91%, 60%)', // Blue
                            'hsl(142, 76%, 36%)', // Green
                            'hsl(38, 92%, 50%)',  // Amber
                            'hsl(0, 84%, 60%)',   // Red
                            'hsl(262, 83%, 58%)', // Purple
                            'hsl(199, 89%, 48%)', // Cyan
                            'hsl(24, 95%, 53%)',  // Orange
                            'hsl(280, 100%, 70%)', // Pink
                          ];
                          return colors[index % colors.length];
                        };

                        return (
                          <Card className="border-2">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                  <BarChart3 className="h-5 w-5 text-primary" />
                                  Entity Type Distribution
                                </CardTitle>
                                <Badge variant="secondary" className="text-sm">
                                  {totalEntities.toLocaleString()} total
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[400px] w-full">
                                <ResponsiveContainer>
                                  <BarChart 
                                    data={chartData} 
                                    margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                                    barCategoryGap="15%"
                                  >
                                    <CartesianGrid 
                                      strokeDasharray="3 3" 
                                      vertical={false}
                                      stroke="hsl(var(--muted))"
                                      opacity={0.3}
                                    />
                                    <XAxis 
                                      dataKey="name"
                                      stroke="hsl(var(--muted-foreground))"
                                      fontSize={11}
                                      tickLine={false}
                                      axisLine={false}
                                      angle={-45}
                                      textAnchor="end"
                                      height={100}
                                      interval={0}
                                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                    />
                                    <YAxis
                                      stroke="hsl(var(--muted-foreground))"
                                      fontSize={11}
                                      tickLine={false}
                                      axisLine={false}
                                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                      tickFormatter={(value) => value.toLocaleString()}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar 
                                      dataKey="count" 
                                      radius={[6, 6, 0, 0]}
                                    >
                                      {chartData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={getBarColor(index, chartData.length)}
                                        />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              {/* Summary table below chart */}
                              <div className="mt-6 pt-4 border-t">
                                <p className="text-sm font-semibold mb-3">All Entity Types ({sortedTypes.length} types):</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                                  {sortedTypes.map((item, index) => (
                                    <div 
                                      key={item.type}
                                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div 
                                          className="w-3 h-3 rounded flex-shrink-0"
                                          style={{ 
                                            backgroundColor: index < topN 
                                              ? getBarColor(index, topN)
                                              : 'hsl(var(--muted-foreground))'
                                          }}
                                        />
                                        <span className="text-xs font-medium truncate">{item.displayName}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
                                        <span className="font-semibold">{item.count.toLocaleString()}</span>
                                        <span>({item.percentage}%)</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {/* Module Performance Chart */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (() => {
                        const moduleCounts: Record<string, number> = {};
                        scanResult.result.entities.forEach((entity: any) => {
                          const module = entity.module ? getModuleDisplayName(entity.module) : 'Unknown';
                          moduleCounts[module] = (moduleCounts[module] || 0) + 1;
                        });
                        
                        const totalDiscoveries = Object.values(moduleCounts).reduce((sum, count) => sum + count, 0);
                        const sortedModules = Object.entries(moduleCounts)
                          .map(([name, value]) => ({ 
                            name, 
                            value,
                            percentage: ((value / totalDiscoveries) * 100).toFixed(1)
                          }))
                          .sort((a, b) => b.value - a.value);
                        
                        // Group small modules into "Others" if data is highly skewed
                        const topN = 5; // Show top 5 modules
                        const othersThreshold = 0.02; // 2% threshold
                        const topModules = sortedModules.slice(0, topN);
                        const remainingModules = sortedModules.slice(topN);
                        const othersTotal = remainingModules.reduce((sum, m) => sum + m.value, 0);
                        const othersPercentage = ((othersTotal / totalDiscoveries) * 100).toFixed(1);
                        
                        // Only group into "Others" if there are many small modules
                        let chartData = topModules;
                        if (remainingModules.length > 0 && othersTotal > 0) {
                          chartData = [
                            ...topModules,
                            { name: 'Others', value: othersTotal, percentage: othersPercentage }
                          ];
                        }

                        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

                        return (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between">
                                <span>Top Modules by Discoveries</span>
                                <Badge variant="secondary" className="text-xs">
                                  Total: {totalDiscoveries.toLocaleString()}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[350px] w-full">
                                <ResponsiveContainer>
                                  <PieChart>
                                    <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="45%"
                                      labelLine={false}
                                      label={({ name, percent }) => {
                                        // Only show labels for slices > 3% to avoid clutter
                                        return percent > 0.03 ? `${name}\n${(percent * 100).toFixed(1)}%` : '';
                                      }}
                                      outerRadius={100}
                                      innerRadius={30}
                                      fill="#8884d8"
                                      dataKey="value"
                                      paddingAngle={2}
                                    >
                                      {chartData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={COLORS[index % COLORS.length]}
                                          stroke="hsl(var(--background))"
                                          strokeWidth={2}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={(value: number, name: string, props: any) => [
                                        `${value.toLocaleString()} (${props.payload.percentage}%)`,
                                        name
                                      ]}
                                      contentStyle={{
                                        backgroundColor: "hsl(var(--background))",
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                      }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={60}
                                      formatter={(value: string) => (
                                        <span className="text-xs text-muted-foreground">{value}</span>
                                      )}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              {/* Detailed list below chart */}
                              <div className="mt-4 pt-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                                  {sortedModules.map((item, index) => (
                                    <div 
                                      key={item.name}
                                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div 
                                          className="w-3 h-3 rounded-full flex-shrink-0"
                                          style={{ 
                                            backgroundColor: index < COLORS.length 
                                              ? COLORS[index % COLORS.length] 
                                              : COLORS[COLORS.length - 1]
                                          }}
                                        />
                                        <span className="text-xs font-medium truncate">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-semibold">{item.value.toLocaleString()}</span>
                                        <span>({item.percentage}%)</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}
                      
                      {/* Export Section - Always show if there are results */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (
                        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                          <div className="mb-3">
                            <p className="text-sm font-semibold">Export Results</p>
                            <p className="text-xs text-muted-foreground">
                              Download scan results in JSON or CSV format
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {/* JSON Export Button */}
                            <Button
                              variant="default"
                              size="sm"
                              onClick={async () => {
                                if (jobId && scanResult.result) {
                                  try {
                                    setError(null);
                                    const res = await fetch(`${API_BASE}/api/v1/external-surface/export-json/${jobId}`, {
                                      method: 'GET'
                                    });
                                    if (res.ok) {
                                      const blob = await res.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      const targetName = currentConfig?.target || scanResult?.target || 'scan';
                                        a.download = `asm_scan_${targetName.replace(/\./g, '_')}_${Date.now()}.json`;
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                    } else {
                                      const errorData = await res.json().catch(() => ({}));
                                      setError(errorData.detail || "Failed to generate JSON");
                                    }
                                  } catch (err) {
                                    console.error("Failed to export JSON:", err);
                                    setError(err instanceof Error ? err.message : "Failed to generate JSON");
                                  }
                                }
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white flex-1"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Export JSON
                            </Button>

                            {/* CSV Export Button */}
                            {scanResult.result.csv_download_url ? (
                              <a
                                href={`${API_BASE}${scanResult.result.csv_download_url}`}
                                download={scanResult.result.csv_filename || "scan_results.csv"}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2 flex-1 justify-center"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download CSV
                              </a>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={async () => {
                                  // Generate CSV on-demand from existing results
                                  if (jobId && scanResult.result.entities) {
                                    try {
                                      setError(null);
                                      const res = await fetch(`${API_BASE}/api/v1/external-surface/export-csv/${jobId}`, {
                                        method: 'GET'
                                      });
                                      if (res.ok) {
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        const targetName = currentConfig?.target || scanResult?.target || 'scan';
                                        a.download = `asm_scan_${targetName.replace(/\./g, '_')}_${Date.now()}.csv`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                        
                                        // Update scan result to show CSV is available
                                        setScanResult({
                                          ...scanResult,
                                          result: {
                                            ...scanResult.result,
                                            csv_filename: a.download,
                                            csv_download_url: `/api/v1/external-surface/export-csv/${jobId}`
                                          }
                                        });
                                      } else {
                                        const errorData = await res.json().catch(() => ({}));
                                        setError(errorData.detail || "Failed to generate CSV");
                                      }
                                    } catch (err) {
                                      console.error("Failed to export CSV:", err);
                                      setError(err instanceof Error ? err.message : "Failed to generate CSV");
                                    }
                                  }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export CSV
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Module Execution Status */}
                      {currentConfig && currentConfig.modules && (
                        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
                          <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Network className="h-4 w-4" />
                              Module Execution Status
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {(() => {
                                // Count entities by module
                                const moduleOutput: Record<string, number> = {};
                                scanResult.result.entities?.forEach((entity: any) => {
                                  const module = entity.module || 'unknown';
                                  moduleOutput[module] = (moduleOutput[module] || 0) + 1;
                                });
                                
                                // Check which modules were enabled but produced no output
                                const enabledModules = currentConfig.modules || [];
                                const modulesWithOutput = Object.keys(moduleOutput);
                                const modulesWithoutOutput = enabledModules.filter(m => !modulesWithOutput.includes(m));
                                
                                return (
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs font-semibold mb-2">Modules with Output ({modulesWithOutput.length}/{enabledModules.length}):</p>
                                      <div className="flex flex-wrap gap-2">
                                        {modulesWithOutput.map((module) => (
                                          <Badge key={module} variant="default" className="text-xs">
                                            {getModuleDisplayName(module)}: {moduleOutput[module]} entities
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {modulesWithoutOutput.length > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                                          ⚠️ Modules Enabled but No Output ({modulesWithoutOutput.length}):
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {modulesWithoutOutput.map((module) => (
                                            <Badge key={module} variant="outline" className="text-xs text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                                              {getModuleDisplayName(module)}
                                            </Badge>
                                          ))}
                                        </div>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                                          These modules may need: API keys, external tools, more scan time, or scan type "all" (not "passive")
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Discovered Entities Table - Grouped by Layer */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (
                        <div className="space-y-4">
                          {/* Layer 1: Infrastructure */}
                          {scanResult.result.entities.filter((e: any) => {
                            const type = (e.type || '').toUpperCase();
                            return ['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER'].includes(type);
                          }).length > 0 && (
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Network className="h-4 w-4" />
                                    Layer 1: Infrastructure Discovery
                                  </span>
                                  <Badge variant="secondary">
                                    {scanResult.result.entities.filter((e: any) => {
                                      const type = (e.type || '').toUpperCase();
                                      return ['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER'].includes(type);
                                    }).length} entities
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Module</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scanResult.result.entities
                                        .filter((e: any) => {
                                          const type = (e.type || '').toUpperCase();
                                          return ['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER'].includes(type);
                                        })
                                        .slice(0, 50)
                                        .map((entity: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            <Badge variant="outline">{entity.type || 'UNKNOWN'}</Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                            {entity.value}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            {entity.module ? getModuleDisplayName(entity.module) : 'N/A'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Layer 2: Technology Stack */}
                          {scanResult.result.entities.filter((e: any) => {
                            const type = (e.type || '').toUpperCase();
                            return ['SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE'].includes(type);
                          }).length > 0 && (
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Zap className="h-4 w-4" />
                                    Layer 2: Technology Stack
                                  </span>
                                  <Badge variant="secondary">
                                    {scanResult.result.entities.filter((e: any) => {
                                      const type = (e.type || '').toUpperCase();
                                      return ['SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE'].includes(type);
                                    }).length} entities
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Module</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scanResult.result.entities
                                        .filter((e: any) => {
                                          const type = (e.type || '').toUpperCase();
                                          return ['SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE'].includes(type);
                                        })
                                        .slice(0, 50)
                                        .map((entity: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">{entity.type || 'UNKNOWN'}</Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                            {entity.value}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            {entity.module ? getModuleDisplayName(entity.module) : 'N/A'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Layer 3: Cloud Storage */}
                          {scanResult.result.entities.filter((e: any) => {
                            const type = (e.type || '').toUpperCase();
                            return ['CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY'].includes(type);
                          }).length > 0 && (
                            <Card className="border-orange-200 dark:border-orange-800">
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Layer 3: Cloud Storage
                                  </span>
                                  <Badge variant="secondary">
                                    {scanResult.result.entities.filter((e: any) => {
                                      const type = (e.type || '').toUpperCase();
                                      return ['CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY'].includes(type);
                                    }).length} entities
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Module</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scanResult.result.entities
                                        .filter((e: any) => {
                                          const type = (e.type || '').toUpperCase();
                                          return ['CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY'].includes(type);
                                        })
                                        .map((entity: any, idx: number) => (
                                        <TableRow key={idx} className={entity.type === 'CLOUD_STORAGE_BUCKET_OPEN' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                                          <TableCell>
                                            <Badge variant={entity.type === 'CLOUD_STORAGE_BUCKET_OPEN' ? 'destructive' : 'outline'}>
                                              {entity.type || 'UNKNOWN'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                            {entity.value}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            {entity.module ? getModuleDisplayName(entity.module) : 'N/A'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Layer 4: Content & Secrets */}
                          {scanResult.result.entities.filter((e: any) => {
                            const type = (e.type || '').toUpperCase();
                            return ['EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL', 'UDP_PORT_OPEN'].includes(type);
                          }).length > 0 && (
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Layer 4: Content & Secrets
                                  </span>
                                  <Badge variant="secondary">
                                    {scanResult.result.entities.filter((e: any) => {
                                      const type = (e.type || '').toUpperCase();
                                      return ['EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL', 'UDP_PORT_OPEN'].includes(type);
                                    }).length} entities
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Module</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scanResult.result.entities
                                        .filter((e: any) => {
                                          const type = (e.type || '').toUpperCase();
                                          return ['EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL', 'UDP_PORT_OPEN'].includes(type);
                                        })
                                        .slice(0, 50)
                                        .map((entity: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">{entity.type || 'UNKNOWN'}</Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                            {entity.value}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            {entity.module ? getModuleDisplayName(entity.module) : 'N/A'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* All Other Entities */}
                          {scanResult.result.entities.filter((e: any) => 
                            !['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER', 
                              'SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE',
                              'CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY',
                              'EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL'].includes((e.type || '').toUpperCase())
                          ).length > 0 && (
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <span>Other Entities</span>
                                  <Badge variant="secondary">
                                    {scanResult.result.entities.filter((e: any) => 
                                      !['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER', 
                                        'SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE',
                                        'CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY',
                                        'EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL'].includes((e.type || '').toUpperCase())
                                    ).length} entities
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Module</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {scanResult.result.entities
                                        .filter((e: any) => 
                                          !['INTERNET_NAME', 'IP_ADDRESS', 'NETBLOCK_OWNER', 'BGP_AS_OWNER', 
                                            'SOFTWARE_USED', 'WEBSERVER_BANNER', 'HTTP_CODE', 'TECHNOLOGY', 'WEBSERVER_HTTPHEADERS', 'TARGET_WEB_CONTENT', 'TARGET_WEB_CONTENT_TYPE',
                                            'CLOUD_STORAGE_BUCKET', 'CLOUD_STORAGE_BUCKET_OPEN', 'CLOUD_STORAGE_BUCKET_OPEN_DIRECTORY',
                                            'EMAIL_ADDRESS', 'FORM_NAME', 'TCP_PORT_OPEN', 'LINKED_URL_INTERNAL', 'LINKED_URL_EXTERNAL'].includes((e.type || '').toUpperCase())
                                        )
                                        .slice(0, 50)
                                        .map((entity: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            <Badge variant="outline">{entity.type || 'UNKNOWN'}</Badge>
                                          </TableCell>
                                          <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                            {entity.value}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            {entity.module ? getModuleDisplayName(entity.module) : 'N/A'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enrich Scan Button - Show when scan is finished and has subdomains */}
                  {status === "finished" && scanResult?.result && scanResult.result.entities_found > 0 && (
                    <div className="flex gap-2 items-center">
                      <Button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/api/v1/external-surface/enrich`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                job_id: jobId,
                                target_subdomains: null, // Enrich all discovered subdomains
                              }),
                            });
                            if (!res.ok) {
                              const errorData = await res.json().catch(() => ({}));
                              throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
                            }
                            const data = await res.json();
                            setJobId(data.job_id);
                            setStatus("queued");
                            setError(null);
                            setWarning(null);
                            setScanResult(null);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to start enrichment scan");
                          }
                        }}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Enrich with Layers 2-4
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Add technology stack, cloud buckets, ports, and content data
                      </p>
                    </div>
                  )}

                  {jobId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Job ID: {jobId}
                    </p>
                  )}
                </CardContent>
            </Card>
          </div>
        )}

        {/* Dashboard when no scan running */}
        {!jobId && !status && (
          <div className="px-6 py-12 text-center">
            <Globe className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Active Scan</h2>
            <p className="text-muted-foreground mb-6">
              Start a scan from the right panel to discover external surface assets
            </p>
          </div>
        )}
      </div>

      {/* Right options sidebar */}
      <aside 
        className="w-64 shrink-0 border-l bg-gray-900 text-white p-6 space-y-8 overflow-y-auto h-full"
        onWheel={(e) => {
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">Start a Scan</h2>
          <p className="text-xs text-gray-400">Configure scan</p>
        </header>

        {/* Target Type */}
        <div className="space-y-2">
          <Label htmlFor="targetType" className="text-xs uppercase tracking-wide text-gray-300 flex items-center gap-1">
            <Network className="h-4 w-4"/>Target Type
          </Label>
          <select
            id="targetType"
            value={targetType}
            onChange={(e)=>setTargetType(e.target.value)}
            disabled={status==='queued'||status==='running'}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="domain">Domain Name</option>
            <option value="ip">IP Address</option>
            <option value="asn">ASN (AS1234)</option>
            <option value="netblock">NetBlock/CIDR</option>
          </select>
        </div>

        <Separator className="bg-gray-700" />

        {/* Target Input */}
        <div className="space-y-2">
          <Label htmlFor="target" className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-300">
            <Network className="h-4 w-4" /> Target {targetType === 'domain' ? 'Domain' : targetType === 'ip' ? 'IP Address' : targetType === 'asn' ? 'ASN' : 'NetBlock'}
          </Label>
          <Input
            id="target"
            value={target}
            onChange={(e)=>setTarget(e.target.value)}
            placeholder={
              targetType === 'domain' ? 'example.com' :
              targetType === 'ip' ? '192.168.1.1' :
              targetType === 'asn' ? 'AS1234' :
              '192.168.0.0/24'
            }
            disabled={status==='queued'||status==='running'}
            className="font-mono bg-gray-800 border-gray-700 placeholder:text-gray-500 text-sm"
          />
        </div>

        <Separator className="bg-gray-700" />

        {/* Scan type */}
        <div className="space-y-2">
          <Label htmlFor="scanType" className="text-xs uppercase tracking-wide text-gray-300 flex items-center gap-1">
            <Zap className="h-4 w-4"/>Scan Type
          </Label>
          <select
            id="scanType"
            value={scanType}
            onChange={(e)=>setScanType(e.target.value)}
            disabled={status==='queued'||status==='running'}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="mvp">MVP (All 4 Layers)</option>
            <option value="enrichment">Enrichment (Layers 2-4 Only)</option>
            <option value="all">All Modules</option>
            <option value="passive">Passive Only (Layer 1)</option>
            <option value="active">Active Only</option>
            <option value="custom">Custom Modules</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {scanType === "mvp" && "Full ASM: Discovery + Technology + Cloud + Content"}
            {scanType === "enrichment" && "Enrich existing scan: Technology, Cloud, Ports, Content"}
            {scanType === "passive" && "Basic discovery only (no active scanning)"}
            {scanType === "active" && "Active scanning modules only"}
          </p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Module selection */}
        {scanType === "custom" && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">Select Modules</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableModules.map((module) => (
                <div key={module} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={module}
                    checked={selectedModules.includes(module)}
                    onChange={() => toggleModule(module)}
                    disabled={status==='queued'||status==='running'}
                    className="rounded bg-gray-800 border-gray-700"
                  />
                  <Label htmlFor={module} className="text-xs text-gray-300 cursor-pointer">
                    {getModuleDisplayName(module)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Scan depth */}
        <div className="space-y-2">
          <Label htmlFor="scanDepth" className="text-xs uppercase tracking-wide text-gray-300">
            Scan Depth
          </Label>
          <Input
            id="scanDepth"
            type="number"
            min="1"
            max="1000"
            value={scanDepth}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1;
              setScanDepth(Math.max(1, Math.min(1000, value)));
            }}
            disabled={status==='queued'||status==='running'}
            className="bg-gray-800 border-gray-700 text-sm"
            placeholder="Enter scan depth (1-1000)"
          />
          <p className="text-xs text-gray-500">Scan depth range: 1-1000 (higher = deeper scan)</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Timeout */}
        <div className="space-y-2">
          <Label htmlFor="timeout" className="text-xs uppercase tracking-wide text-gray-300">
            Scan Timeout
          </Label>
          <div className="space-y-3">
            {/* Preset buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant={scanTimeout === 300 ? "default" : "outline"}
                size="sm"
                onClick={() => setScanTimeout(300)}
                disabled={status==='queued'||status==='running'}
                className="text-xs"
              >
                5 min
              </Button>
              <Button
                type="button"
                variant={scanTimeout === 900 ? "default" : "outline"}
                size="sm"
                onClick={() => setScanTimeout(900)}
                disabled={status==='queued'||status==='running'}
                className="text-xs"
              >
                15 min
              </Button>
              <Button
                type="button"
                variant={scanTimeout === 3600 ? "default" : "outline"}
                size="sm"
                onClick={() => setScanTimeout(3600)}
                disabled={status==='queued'||status==='running'}
                className="text-xs"
              >
                1 hour
              </Button>
              <Button
                type="button"
                variant={scanTimeout === 7200 ? "default" : "outline"}
                size="sm"
                onClick={() => setScanTimeout(7200)}
                disabled={status==='queued'||status==='running'}
                className="text-xs"
              >
                2 hours
              </Button>
            </div>
            {/* Custom input */}
            <div className="flex items-center gap-2">
              <Input
                id="timeout"
                type="number"
                min="10"
                max="86400"
                step="10"
                value={scanTimeout}
                onChange={(e) => setScanTimeout(parseInt(e.target.value) || 3600)}
                disabled={status==='queued'||status==='running'}
                className="bg-gray-800 border-gray-700 text-sm"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {scanTimeout < 60 
                  ? `(${scanTimeout} sec)`
                  : scanTimeout < 3600
                  ? `(${Math.floor(scanTimeout / 60)} min)`
                  : `(${Math.floor(scanTimeout / 3600)} hr)`
                }
              </span>
            </div>
            <p className="text-xs text-gray-500">Custom timeout in seconds (10-86400, max 24 hours)</p>
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Max threads */}
        <div className="space-y-2">
          <Label htmlFor="maxThreads" className="text-xs uppercase tracking-wide text-gray-300">
            Max Threads
          </Label>
          <Input
            id="maxThreads"
            type="number"
            min="1"
            max="50"
            value={maxThreads}
            onChange={(e)=>setMaxThreads(parseInt(e.target.value) || 10)}
            disabled={status==='queued'||status==='running'}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">Concurrent module execution</p>
        </div>

        <Separator className="bg-gray-700" />

        <Button
          disabled={!target.trim() || (status==='queued'||status==='running') || (scanType === "custom" && selectedModules.length === 0)}
          onClick={()=>handleStartScan({
            target: target.trim(),
            targetType,
            scanType,
            modules: scanType === "custom" ? selectedModules : [],
            scanDepth,
            scanTimeout,
            maxThreads
          })}
          className="w-full mt-4"
        >
          {status==='queued'||status==='running'? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Running...</>): (<>Start Scan</>)}
        </Button>
      </aside>
    </div>
  );
}

