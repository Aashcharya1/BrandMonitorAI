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
  Shield
} from "lucide-react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SpiderFootConfig {
  target: string;
  scanType: string;
  modules: string[];
  scanDepth: number;
  scanTimeout: number;
  outputFormat: string;
  maxThreads: number;
}

export default function ExternalSurfaceMonitoringPage() {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("all");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [scanDepth, setScanDepth] = useState(3);
  const [scanTimeout, setScanTimeout] = useState(3600);
  const [outputFormat, setOutputFormat] = useState("json");
  const [maxThreads, setMaxThreads] = useState(10);
  const [currentConfig, setCurrentConfig] = useState<SpiderFootConfig | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const availableModules = [
    "sfp_dnsresolve",
    "sfp_dnsbrute",
    "sfp_subdomain",
    "sfp_whois",
    "sfp_webanalyze",
    "sfp_portscan",
    "sfp_ssl",
    "sfp_certificate",
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
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
        if (data.status === "finished") {
          setScanResult(data.result || null);
          if (intervalRef.current) clearInterval(intervalRef.current);
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

  const handleStartScan = async (config: SpiderFootConfig) => {
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
          scan_type: config.scanType,
          modules: config.modules.length > 0 ? config.modules : availableModules,
          scan_depth: config.scanDepth,
          timeout: config.scanTimeout,
          output_format: config.outputFormat,
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

  const handleNewScan = () => {
    setTarget("");
    setScanType("all");
    setSelectedModules([]);
    setScanDepth(3);
    setScanTimeout(3600);
    setOutputFormat("json");
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

                  {scanResult && (
                    <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{scanResult.entities_found || 0}</p>
                        <p className="text-xs text-muted-foreground">Entities</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{scanResult.data_points || 0}</p>
                        <p className="text-xs text-muted-foreground">Data Points</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{scanResult.modules_run || 0}</p>
                        <p className="text-xs text-muted-foreground">Modules Run</p>
                      </div>
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
          <>
            <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-[#0c1729] dark:to-[#121f35] shadow-sm mx-6">
              <CardContent className="py-4 flex justify-around">
                {[
                  { label: "Domains", color: "bg-blue-600", count: 0, icon: "🌐" },
                  { label: "IPs", color: "bg-green-500", count: 0, icon: "📍" },
                  { label: "Services", color: "bg-purple-400", count: 0, icon: "🔌" },
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 px-6">
              {[
                { title: "Recent Scans", subtitle: "Latest external surface scans", icon: "📄" },
                { title: "Discovered Assets", subtitle: "External assets found", icon: "🔍" },
                { title: "Threat Intelligence", subtitle: "Security findings", icon: "🛡️" },
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
          <p className="text-xs text-gray-400">Configure SpiderFoot scan</p>
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
            <option value="all">All Modules</option>
            <option value="passive">Passive Only</option>
            <option value="active">Active Only</option>
            <option value="custom">Custom Modules</option>
          </select>
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
                    {module.replace("sfp_", "")}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-gray-700" />

        {/* Scan depth */}
        <div className="space-y-2">
          <Label htmlFor="scanDepth" className="text-xs uppercase tracking-wide text-gray-300">
            Scan Depth
          </Label>
          <Input
            id="scanDepth"
            type="number"
            min="1"
            max="10"
            value={scanDepth}
            onChange={(e)=>setScanDepth(parseInt(e.target.value) || 3)}
            disabled={status==='queued'||status==='running'}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">How deep to crawl (1-10)</p>
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

        <Separator className="bg-gray-700" />

        {/* Output format */}
        <div className="space-y-2">
          <Label htmlFor="outputFormat" className="text-xs uppercase tracking-wide text-gray-300">
            Output Format
          </Label>
          <select
            id="outputFormat"
            value={outputFormat}
            onChange={(e)=>setOutputFormat(e.target.value)}
            disabled={status==='queued'||status==='running'}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xml">XML</option>
            <option value="html">HTML</option>
          </select>
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

        <Button
          disabled={!target.trim() || (status==='queued'||status==='running') || (scanType === "custom" && selectedModules.length === 0)}
          onClick={()=>handleStartScan({
            target: target.trim(),
            scanType,
            modules: scanType === "custom" ? selectedModules : [],
            scanDepth,
            scanTimeout,
            outputFormat,
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

