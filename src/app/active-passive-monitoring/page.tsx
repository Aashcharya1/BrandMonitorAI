"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  BarChart3,
  Network,
  Zap,
  Shield
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);


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
        if (data.result) setScanResult(data.result);
        
        // Stop polling when scan is complete
        if (data.status === "finished" || data.status === "failed" || data.status === "canceled") {
          if (intervalRef.current) clearInterval(intervalRef.current);
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

  // Meilisearch search
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/monitor/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
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
    setSearchQuery("");
    setSearchResults([]);
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
        {/* Main Content */}
        {!jobId && !status && (
          <>
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Activity className="h-6 w-6" />
                  Active & Passive Monitoring
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

            {/* Quick Search (Meilisearch) */}
            {status === "finished" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Quick Search Assets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search assets by domain, hostname, IP, or service..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      className="flex-1"
                    />
                    {isSearching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Found {searchResults.length} result(s)</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {searchResults.map((result, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{result.hostname || result.domain}</p>
                                {result.ip && (
                                  <p className="text-xs text-muted-foreground font-mono">{result.ip}</p>
                                )}
                                {result.services && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {JSON.parse(result.services || "[]").slice(0, 3).map((svc: any, i: number) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {svc.name}:{svc.port}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Scan Status Card */}
            {(jobId || status) && (
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

                  {/* Warning Message */}
                  {warning && (
                    <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
                      <div className="flex items-start gap-2">
                        <Activity className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Worker Not Running</p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{warning}</p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-mono bg-yellow-100 dark:bg-yellow-900/50 p-2 rounded">
                            celery -A celery_app worker --loglevel=info --pool=solo
                          </p>
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
                            Passive (amass)
                          </Badge>
                        )}
                        {currentConfig.enableActive && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                            Active (masscan + nmap)
                          </Badge>
                        )}
                        {currentConfig.enableVuln && (
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                            Vulnerabilities (Nessus)
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scan Results Summary */}
                  {scanResult && (
                    <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{scanResult.assets_found || 0}</p>
                        <p className="text-xs text-muted-foreground">Assets</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{scanResult.services_found || 0}</p>
                        <p className="text-xs text-muted-foreground">Services</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{scanResult.vulnerabilities_found || 0}</p>
                        <p className="text-xs text-muted-foreground">
                          {scanResult.nessus_skipped ? (
                            <span className="text-orange-500">Nessus not configured (optional)</span>
                          ) : (
                            "Vulnerabilities"
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Job ID */}
                  {jobId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Job ID: {jobId}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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
          </>
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
