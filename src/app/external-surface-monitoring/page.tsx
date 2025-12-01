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
    // Passive Discovery Modules (Critical for subdomain enumeration)
    "sfp_crt",              // Certificate Transparency - CRITICAL
    "sfp_subdomain",        // General subdomain enumeration
    "sfp_dnsbrute",         // DNS brute forcing
    "sfp_dnsresolve",       // DNS resolution
    "sfp_hackertarget",     // HackerTarget API
    "sfp_threatcrowd",      // ThreatCrowd API
    "sfp_whois",            // WHOIS lookups
    "sfp_dnscommonsrv",     // DNS common SRV records
    "sfp_dnsdb",            // DNS database lookups
    // API-based modules (require API keys)
    "sfp_virustotal",       // VirusTotal API
    "sfp_shodan",           // Shodan API
    "sfp_securitytrails",   // SecurityTrails API
    "sfp_censys",           // Censys API
    // Analysis Modules
    "sfp_webanalyze",       // Web analysis
    "sfp_ssl",              // SSL certificate analysis
    "sfp_certificate",      // Certificate parsing
    // Active Modules
    "sfp_portscan",         // Port scanning
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

                      {/* Entity Type Distribution Chart */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (() => {
                        const entityTypeCounts: Record<string, number> = {};
                        scanResult.result.entities.forEach((entity: any) => {
                          const type = entity.type || 'UNKNOWN';
                          entityTypeCounts[type] = (entityTypeCounts[type] || 0) + 1;
                        });
                        const chartData = Object.entries(entityTypeCounts)
                          .map(([name, count]) => ({ name, count }))
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 10);

                        return (
                          <Card>
                            <CardHeader>
                              <CardTitle>Entity Type Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[300px] w-full">
                                <ResponsiveContainer>
                                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                      dataKey="name"
                                      stroke="hsl(var(--muted-foreground))"
                                      fontSize={12}
                                      tickLine={false}
                                      axisLine={false}
                                      angle={-45}
                                      textAnchor="end"
                                      height={80}
                                    />
                                    <YAxis
                                      stroke="hsl(var(--muted-foreground))"
                                      fontSize={12}
                                      tickLine={false}
                                      axisLine={false}
                                    />
                                    <Tooltip
                                      cursor={{ fill: "hsl(var(--muted))" }}
                                      contentStyle={{
                                        backgroundColor: "hsl(var(--background))",
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                      }}
                                    />
                                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {/* Module Performance Chart */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (() => {
                        const moduleCounts: Record<string, number> = {};
                        scanResult.result.entities.forEach((entity: any) => {
                          const module = entity.module ? entity.module.replace('sfp_', '') : 'Unknown';
                          moduleCounts[module] = (moduleCounts[module] || 0) + 1;
                        });
                        const chartData = Object.entries(moduleCounts)
                          .map(([name, value]) => ({ name, value }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 8);

                        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

                        return (
                          <Card>
                            <CardHeader>
                              <CardTitle>Top Modules by Discoveries</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-[300px] w-full">
                                <ResponsiveContainer>
                                  <PieChart>
                                    <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      label={({ name, value }) => `${name}: ${value}`}
                                      outerRadius={100}
                                      fill="#8884d8"
                                      dataKey="value"
                                    >
                                      {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: "hsl(var(--background))",
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                      }}
                                    />
                                    <Legend />
                                  </PieChart>
                                </ResponsiveContainer>
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
                                      a.download = `spiderfoot_${targetName.replace(/\./g, '_')}_${Date.now()}.json`;
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
                                        a.download = `spiderfoot_${targetName.replace(/\./g, '_')}_${Date.now()}.csv`;
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
                      
                      {/* Discovered Entities Table */}
                      {scanResult.result.entities && scanResult.result.entities.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span>Discovered Entities</span>
                              <Badge variant="secondary">{scanResult.result.entities.length} total</Badge>
                            </CardTitle>
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
                                  {scanResult.result.entities.slice(0, 100).map((entity: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                          {entity.type || 'UNKNOWN'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="font-mono text-sm max-w-md truncate" title={entity.value}>
                                        {entity.value}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-xs">
                                        {entity.module ? entity.module.replace('sfp_', '') : 'N/A'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              {scanResult.result.entities.length > 100 && (
                                <div className="text-center p-4 text-sm text-muted-foreground">
                                  Showing first 100 of {scanResult.result.entities.length} entities. 
                                  Export to CSV/JSON to see all results.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
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

