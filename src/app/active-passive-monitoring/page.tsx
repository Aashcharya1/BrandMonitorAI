"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  BarChart3,
  Network,
  Zap,
  Shield,
  Download,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScanConfig {
  target: string;
  enablePassive: boolean;
  enableActive: boolean;
  enableVuln: boolean;
  nessusPolicyUuid: string;
  portRange?: string;
  scanIntensity: string;
  maxThreads: number;
  scanTimeout: number;
}

export default function ActivePassiveMonitoringPage() {
  // Scan configuration form state (now in sidebar)
  const [target, setTarget] = useState("");
  const [enablePassive, setEnablePassive] = useState(true);
  const [enableActive, setEnableActive] = useState(true);
  const [enableVuln, setEnableVuln] = useState(false);
  const [nessusPolicyUuid, setNessusPolicyUuid] = useState("");
  const [portRange, setPortRange] = useState("");
  const [scanIntensity, setScanIntensity] = useState("normal");
  const [maxThreads, setMaxThreads] = useState(10);
  const [scanTimeout, setScanTimeout] = useState(3600);
  const [currentConfig, setCurrentConfig] = useState<ScanConfig | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug: Log state changes
  useEffect(() => {
    console.log("State update:", { jobId, status, hasScanResult: !!scanResult, scanResultKeys: scanResult ? Object.keys(scanResult) : [] });
  }, [jobId, status, scanResult]);

  // Poll scan status
  useEffect(() => {
    if (!jobId) return;
    
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/monitor/status/${jobId}`);
        if (!res.ok) {
          try {
            const errorData = await res.json();
            const errorMsg = errorData.detail || errorData.error || `HTTP ${res.status}: ${res.statusText}`;
            
            // If it's a service unavailable (503), it's likely a Celery/Redis issue
            if (res.status === 503) {
              setError(errorMsg + " Please ensure Redis and Celery worker are running.");
              // Don't stop polling - might be temporary
            } else if (res.status === 404) {
              setError("Scan job not found. It may have expired or been cleared.");
              // Stop polling for 404 - job doesn't exist
              if (intervalRef.current) clearInterval(intervalRef.current);
              return;
            } else {
              setError(errorMsg);
            }
          } catch {
            // If JSON parsing fails, use status text
            if (res.status >= 500) {
              setError(`Server error (${res.status}) while checking scan status. Retrying...`);
            } else if (res.status === 404) {
              setError("Scan job not found. It may have expired or been cleared.");
              // Stop polling for 404
              if (intervalRef.current) clearInterval(intervalRef.current);
              return;
            } else {
              setError(`Error ${res.status}: ${res.statusText}`);
            }
          }
          return;
        }
        const data = await res.json();
        console.log("Status poll response:", { status: data.status, hasResult: !!data.result, jobId });
        
        setStatus(data.status || null);
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
        if (data.warning) {
          setWarning(data.warning);
        } else {
          setWarning(null);
        }
        if (data.result_url) setResultUrl(data.result_url);
        if (data.result) {
          console.log("Scan result received:", data.result);
          setScanResult(data.result);
          // Ensure status is set to finished if we have results
          if (!data.status || data.status !== "finished") {
            setStatus("finished");
          }
        } else if (data.status === "finished") {
          console.warn("Scan finished but no result data received", data);
        }
        
        // Stop polling when scan is complete AND we have results (or it failed/canceled)
        if ((data.status === "finished" && data.result) || data.status === "failed" || data.status === "canceled") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            console.log("Stopped polling - scan complete with results");
          }
        } else if (data.status === "finished" && !data.result) {
          // Keep polling if finished but no results yet (might be a timing issue)
          console.log("Scan finished but no results yet, continuing to poll...");
        }
      } catch (err: any) {
        // Set error for connection issues with more detail
        const errorMessage = err.message || "Failed to check scan status";
        setError(errorMessage.includes("Failed") ? errorMessage : `Failed to check scan status: ${errorMessage}`);
        
        // If it's a connection error, provide helpful message
        if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
          setError("Cannot connect to server. Please ensure the backend API is running at " + API_BASE);
        }
      }
    };
    
    poll();
    intervalRef.current = setInterval(poll, 5000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  // Auto-start scan when dialog submits
  const handleStartScan = async (config: ScanConfig) => {
    // Clear any existing polling interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Clear previous scan results
    setScanResult(null);
    setWarning(null);
    setResultUrl(null);
    setError(null);
    
    // Set new configuration
    setCurrentConfig(config);
    setTarget(config.target); // Update local state for display
    setEnablePassive(config.enablePassive);
    setEnableActive(config.enableActive);
    setEnableVuln(config.enableVuln);
    setNessusPolicyUuid(config.nessusPolicyUuid);
    
    try {
      const res = await fetch(`${API_BASE}/api/v1/monitor/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          target: config.target,
          nessus_policy_uuid: config.enableVuln ? (config.nessusPolicyUuid || undefined) : undefined,
          enable_passive: config.enablePassive,
          enable_active: config.enableActive,
          enable_vuln: config.enableVuln,
          port_range: config.portRange || undefined,
          scan_intensity: config.scanIntensity,
          max_threads: config.maxThreads,
          timeout: config.scanTimeout
        }),
      });
      
      if (!res.ok) {
        let errorMessage = "Failed to start scan";
        try {
          const errorData = await res.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        setError(errorMessage);
        setStatus("failed");
        return;
      }
      
      const data = await res.json();
      setJobId(data.job_id || null);
      setStatus("queued");
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to connect to server. Please check if the backend is running.";
      setError(errorMessage);
      setStatus("failed");
    }
  };

  const handleNewScan = () => {
    setTarget("");
    setEnablePassive(true);
    setEnableActive(true);
    setEnableVuln(false);
    setNessusPolicyUuid("");
    setCurrentConfig(null);
    setStatus(null);
    setError(null);
    setWarning(null);
    setResultUrl(null);
    setJobId(null);
    setScanResult(null);
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
    return <Activity className="h-5 w-5 text-yellow-600" />;
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
              <Activity className="h-6 w-6" />
              Active & Passive Monitoring
            </h1>
            {/* Only show scanning info when there's an active scan */}
            {currentConfig && (jobId || status || scanResult) && (
              <p className="text-sm text-muted-foreground mt-1">
                Scanning: <span className="font-mono font-medium">{currentConfig.target}</span>
              </p>
            )}
            {status && !currentConfig && (jobId || scanResult) && (
              <p className="text-sm text-muted-foreground mt-1">
                Status: <span className="font-mono font-medium capitalize">{status}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {/* New Scan button only shows when scan is finished and results are shown */}
            {scanResult && status === "finished" && (
              <Button variant="outline" onClick={handleNewScan}>
                <RefreshCw className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            )}
          </div>
        </div>

        {/* Empty state when no scan - only show this when nothing is active */}
        {!jobId && !status && !scanResult && (
          <div className="px-6 py-12 text-center">
            <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Active Scan</h2>
            <p className="text-muted-foreground mb-6">
              Start a scan from the right panel to discover assets, services, and vulnerabilities
            </p>
          </div>
        )}

        {/* Main Content - only show when there's an active scan or results */}
        {(jobId || status || scanResult) && (
          <div className="px-6 space-y-6">
            {/* Scan Status Card */}
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      Scan Status
                    </div>
                    <div className="flex items-center gap-3">
                      {status && (
                        <span className={`text-sm font-normal ${getStatusColor(status)}`}>
                          {getProgressValue(status)}%
                        </span>
                      )}
                      {/* Export Dropdown */}
                      {scanResult && status === "finished" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                              <Download className="h-4 w-4" />
                              Export as
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={async () => {
                                if (jobId && scanResult) {
                                  try {
                                    setError(null);
                                    // Export as JSON
                                    const jsonStr = JSON.stringify(scanResult, null, 2);
                                    const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
                                    const url = window.URL.createObjectURL(jsonBlob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    const targetName = currentConfig?.target || scanResult?.domain || 'scan';
                                    a.download = `monitoring_scan_${targetName.replace(/\./g, '_')}_${Date.now()}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                  } catch (err) {
                                    console.error("Failed to export JSON:", err);
                                    setError(err instanceof Error ? err.message : "Failed to generate JSON");
                                  }
                                }
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export as JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (jobId && scanResult) {
                                  try {
                                    setError(null);
                                    const res = await fetch(`${API_BASE}/api/v1/monitor/export-csv/${jobId}`, {
                                      method: 'GET'
                                    });
                                    if (res.ok) {
                                      const blob = await res.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      const targetName = currentConfig?.target || scanResult?.domain || 'scan';
                                      a.download = `monitoring_scan_${targetName.replace(/\./g, '_')}_${Date.now()}.csv`;
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
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
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export as CSV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Error Message */}
                  {error && (
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

                  {/* Progress Bar */}
                  {status && !error && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="capitalize font-medium">{status}</span>
                      </div>
                      <Progress value={getProgressValue(status)} className="h-2" />
                      {status === "queued" && (
                        <div className="mt-3 p-3 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">Task is queued</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Current Configuration */}
                  {currentConfig && (
                    <div className="p-5 border rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Scan Configuration</p>
                        <Badge variant="secondary" className="text-xs">
                          {currentConfig.target}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {currentConfig.enablePassive && (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                            <Network className="h-3 w-3 mr-1" />
                            Passive 
                          </Badge>
                        )}
                        {currentConfig.enableActive && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                            <Zap className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {currentConfig.enableVuln && (
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                            <Shield className="h-3 w-3 mr-1" />
                            Vulnerabilities 
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scan Results Summary */}
                  {scanResult && (
                    <>
                      {/* Warning if timeout occurred */}
                      {scanResult.timed_out && scanResult.warning && (
                        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                          <div className="flex items-start gap-2">
                            <Activity className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Timeout Reached</p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{scanResult.warning}</p>
                              {scanResult.elapsed_time && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                  Elapsed time: {Math.round(scanResult.elapsed_time)}s
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{scanResult.assets_found || scanResult.subdomains?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Assets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{scanResult.services_found || scanResult.services?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Services</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">{scanResult.vulnerabilities_found || scanResult.vulnerabilities?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">
                            {scanResult.nessus_skipped ? (
                              <span className="text-orange-500">Nessus not configured (optional)</span>
                            ) : (
                              "Vulnerabilities"
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Subdomains List */}
                      {scanResult.subdomains && scanResult.subdomains.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Discovered Subdomains ({scanResult.subdomains.length})</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {scanResult.subdomains.slice(0, 50).map((subdomain: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-sm font-mono">
                                  <Badge variant="outline" className="text-xs">{subdomain}</Badge>
                                  {scanResult.host_to_ip?.[subdomain] && (
                                    <span className="text-xs text-muted-foreground">({scanResult.host_to_ip[subdomain]})</span>
                                  )}
                                </div>
                              ))}
                              {scanResult.subdomains.length > 50 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  ... and {scanResult.subdomains.length - 50} more
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Services List */}
                      {scanResult.services && scanResult.services.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Discovered Services ({scanResult.services.length})</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {scanResult.services.slice(0, 100).map((service: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 p-2 border rounded text-sm">
                                  <Badge variant="outline" className="font-mono">{service.hostname || 'unknown'}</Badge>
                                  {service.ip && (
                                    <span className="text-xs text-muted-foreground font-mono">{service.ip}</span>
                                  )}
                                  <Badge variant="secondary">{service.name || 'unknown'}</Badge>
                                  <span className="text-xs font-mono">:{service.port}</span>
                                  {/* Port Status Indicator - All services in this list are confirmed open */}
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Open
                                  </Badge>
                                  {service.version && service.version !== 'unknown' && (
                                    <span className="text-xs text-muted-foreground">({service.version})</span>
                                  )}
                                </div>
                              ))}
                              {scanResult.services.length > 100 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  ... and {scanResult.services.length - 100} more
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Vulnerabilities List */}
                      {scanResult.vulnerabilities && scanResult.vulnerabilities.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Vulnerabilities ({scanResult.vulnerabilities.length})</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {scanResult.vulnerabilities.slice(0, 50).map((vuln: any, idx: number) => {
                                // Handle both severity_name (from Nessus) and severity (number or string)
                                const severityName = vuln.severity_name || 
                                  (vuln.severity === 'Critical' || vuln.severity === '4' ? 'Critical' :
                                   vuln.severity === 'High' || vuln.severity === '3' ? 'High' :
                                   vuln.severity === 'Medium' || vuln.severity === '2' ? 'Medium' :
                                   vuln.severity === 'Low' || vuln.severity === '1' ? 'Low' : 'Unknown');
                                const isCritical = severityName === 'Critical' || severityName === 'High';
                                
                                return (
                                  <div key={idx} className="p-2 border rounded text-sm">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={isCritical ? 'destructive' : 'secondary'}>
                                        {severityName}
                                      </Badge>
                                      <span className="font-medium">{vuln.name || 'Unknown vulnerability'}</span>
                                      {vuln.cvss_score && vuln.cvss_score > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          CVSS: {vuln.cvss_score.toFixed(1)}
                                        </Badge>
                                      )}
                                    </div>
                                    {vuln.host && (
                                      <p className="text-xs text-muted-foreground mt-1">Host: {vuln.host}</p>
                                    )}
                                    {vuln.cve && (
                                      <p className="text-xs text-muted-foreground">CVE: {vuln.cve}</p>
                                    )}
                                    {vuln.plugin_id && (
                                      <p className="text-xs text-muted-foreground">Plugin ID: {vuln.plugin_id}</p>
                                    )}
                                    {vuln.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{vuln.description}</p>
                                    )}
                                  </div>
                                );
                              })}
                              {scanResult.vulnerabilities.length > 50 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  ... and {scanResult.vulnerabilities.length - 50} more
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Nessus Status Messages */}
                      {scanResult.nessus_skipped && (
                        <div className="p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                          <div className="flex items-start gap-2">
                            <Shield className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Nessus Scan Skipped</p>
                              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                                {scanResult.nessus_skipped_reason || 'Nessus not configured (optional)'}
                              </p>
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                                To enable Nessus scanning, configure NESSUS_URL, NESSUS_ACCESS_KEY, and NESSUS_SECRET_KEY in your .env file.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {scanResult.nessus_error && (
                        <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">Nessus Scan Error</p>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                {scanResult.nessus_error}
                              </p>
                              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                Check Nessus server status and API credentials. Any vulnerabilities found before the error are still displayed above.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {scanResult.vulnerabilities && scanResult.vulnerabilities.length === 0 && !scanResult.nessus_skipped && !scanResult.nessus_error && currentConfig?.enableVuln && (
                        <div className="p-4 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/20">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-800 dark:text-green-200">No Vulnerabilities Found</p>
                              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                Nessus scan completed successfully. No vulnerabilities detected (this may indicate a secure target).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Job ID */}
                  {jobId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Job ID: {jobId}
                    </p>
                  )}

                  {/* Show message if scan finished but no results yet */}
                  {status === "finished" && !scanResult && (
                    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Scan completed. Retrieving results...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

            {/* Kibana Dashboard Embed */}
            {resultUrl && status === "finished" && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Scan Results Dashboard
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Complete
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="w-full border rounded-lg overflow-hidden shadow-lg">
                    <iframe
                      title="Kibana Dashboard"
                      src={resultUrl}
                      className="w-full h-[75vh] border-0"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Dashboard loads scan results in real-time. Use filters and visualizations to explore findings.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Dashboard when no scan running */}
            {!jobId && !status && (
              <>
                {/* Summary bar */}
                <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-[#0c1729] dark:to-[#121f35] shadow-sm">
                  <CardContent className="py-4 flex justify-around">
                    {[
                      { label: "Critical", color: "bg-red-600", count: 0, icon: "🔴" },
                      { label: "Medium", color: "bg-orange-500", count: 0, icon: "🟠" },
                      { label: "Low", color: "bg-yellow-400", count: 0, icon: "🟡" },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col items-center gap-1">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-lg font-bold">{item.count}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {[
                    { title: "10 Recent Assets", subtitle: "Most recently discovered assets", icon: "📄" },
                    { title: "Top Services", subtitle: "Common open services", icon: "🔌" },
                    { title: "Vulnerability Trends", subtitle: "Last 30 days", icon: "📈" },
                    { title: "Scan History", subtitle: "Previous scans summary", icon: "🕑" },
                  ].map((card) => (
                    <Card
                      key={card.title}
                      className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br from-slate-100 to-white dark:from-[#16233a] dark:to-[#0f1b2e] border-0"
                    >
                      <CardContent className="p-6 space-y-2">
                        <div className="text-3xl mb-1">{card.icon}</div>
                        <h3 className="font-semibold text-lg leading-snug">
                          {card.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {card.subtitle}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
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
          <p className="text-xs text-gray-400">Configure and launch</p>
        </header>

        {/* Target domain */}
        <div className="space-y-2">
          <Label htmlFor="target" className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-300">
            <Network className="h-4 w-4" /> Target Domain
          </Label>
          <Input
            id="target"
            value={target}
            onChange={(e)=>setTarget(e.target.value)}
            placeholder="example.com"
            disabled={status==='queued'||status==='running'}
            className="font-mono bg-gray-800 border-gray-700 placeholder:text-gray-500 text-sm"
          />
        </div>

        <Separator className="bg-gray-700" />

        {/* Scan type toggles */}
        <section className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="text-sm">Passive Recon<br/><span className="text-xs text-gray-400"></span></div>
            <Switch id="passive" checked={enablePassive} onCheckedChange={setEnablePassive} disabled={status==='queued'||status==='running'} />
          </div>
          <div className="flex items-start justify-between">
            <div className="text-sm">Active Scan<br/><span className="text-xs text-gray-400"></span></div>
            <Switch id="active" checked={enableActive} onCheckedChange={setEnableActive} disabled={status==='queued'||status==='running'} />
          </div>
          <div className="flex items-start justify-between">
            <div className="text-sm">Vulnerability<br/><span className="text-xs text-gray-400"></span></div>
            <Switch id="vuln" checked={enableVuln} onCheckedChange={setEnableVuln} disabled={status==='queued'||status==='running'} />
          </div>
        </section>

        {/* Nessus policy input */}
        {enableVuln && (
          <div className="space-y-2">
            <Label htmlFor="policy" className="text-xs uppercase tracking-wide text-gray-300 flex items-center gap-1"><Shield className="h-4 w-4"/>Policy UUID</Label>
            <Input id="policy" value={nessusPolicyUuid} onChange={(e)=>setNessusPolicyUuid(e.target.value)} placeholder="Optional" disabled={status==='queued'||status==='running'} className="font-mono bg-gray-800 border-gray-700 text-sm" />
          </div>
        )}

        <Separator className="bg-gray-700" />

        {/* Port range */}
        {enableActive && (
          <div className="space-y-2">
            <Label htmlFor="portRange" className="text-xs uppercase tracking-wide text-gray-300">
              Port Range (Optional)
            </Label>
            <Input
              id="portRange"
              value={portRange}
              onChange={(e)=>setPortRange(e.target.value)}
              placeholder="1-1000 or 80,443,8080"
              disabled={status==='queued'||status==='running'}
              className="font-mono bg-gray-800 border-gray-700 text-sm"
            />
            <p className="text-xs text-gray-500">Leave empty for default ports</p>
          </div>
        )}

        {enableActive && <Separator className="bg-gray-700" />}

        {/* Scan intensity */}
        {enableActive && (
          <div className="space-y-2">
            <Label htmlFor="scanIntensity" className="text-xs uppercase tracking-wide text-gray-300">
              Scan Intensity
            </Label>
            <select
              id="scanIntensity"
              value={scanIntensity}
              onChange={(e)=>setScanIntensity(e.target.value)}
              disabled={status==='queued'||status==='running'}
              className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
            >
              <option value="light">Light (Fast)</option>
              <option value="normal">Normal</option>
              <option value="aggressive">Aggressive (Slow)</option>
            </select>
          </div>
        )}

        {enableActive && <Separator className="bg-gray-700" />}

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
          <p className="text-xs text-gray-500">Concurrent operations</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Timeout */}
        <div className="space-y-2">
          <Label htmlFor="timeout" className="text-xs uppercase tracking-wide text-gray-300">
            Timeout (seconds)
          </Label>
          <Input
            id="timeout"
            type="number"
            min="60"
            max="86400"
            value={scanTimeout}
            onChange={(e)=>setScanTimeout(parseInt(e.target.value) || 3600)}
            disabled={status==='queued'||status==='running'}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">Maximum scan duration</p>
        </div>

        <Button
          disabled={!target.trim() || (status==='queued'||status==='running') || (!enablePassive && !enableActive && !enableVuln)}
          onClick={()=>handleStartScan({
            target: target.trim(),
            enablePassive,
            enableActive,
            enableVuln,
            nessusPolicyUuid,
            portRange: portRange.trim() || undefined,
            scanIntensity,
            maxThreads,
            scanTimeout
          })}
          className="w-full mt-4"
        >
          {status==='queued'||status==='running'? (<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Running...</>): (<>Start Scan</>)}
        </Button>
      </aside>
    </div>
  );
}
