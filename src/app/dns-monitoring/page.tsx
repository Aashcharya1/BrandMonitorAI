"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DnsBarChart } from "@/components/charts/DnsBarChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Network, Loader2, CheckCircle2, XCircle, RefreshCw, Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DNSConfig {
  domain: string;
  recordTypes: string[];
  monitoringInterval: string;
  nameservers?: string[];
  alertThreshold: number;
  checkTimeout: number;
  enableChangeDetection: boolean;
}

export default function DnsMonitoringPage() {
  const [domain, setDomain] = useState("");
  const [recordTypes, setRecordTypes] = useState<string[]>(["A", "AAAA", "MX", "TXT", "NS"]);
  const [monitoringInterval, setMonitoringInterval] = useState("hourly");
  const [nameservers, setNameservers] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [checkTimeout, setCheckTimeout] = useState(30);
  const [enableChangeDetection, setEnableChangeDetection] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Helper to safely set error (always string)
  const setErrorSafe = (err: any) => {
    if (err === null || err === undefined) {
      setError(null);
      return;
    }
    const errorStr = typeof err === 'string' 
      ? err 
      : (err instanceof Error 
          ? err.message 
          : (typeof err === 'object' 
              ? JSON.stringify(err) 
              : String(err)));
    setError(errorStr);
  };

  const availableRecordTypes = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR", "SRV", "DNSKEY"];

  const toggleRecordType = (type: string) => {
    setRecordTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleStartMonitoring = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!domain.trim()) {
        setErrorSafe("Domain is required");
        setIsLoading(false);
        return;
      }

      const requestBody = {
        domain: domain.trim(),
        record_types: recordTypes,
        interval: monitoringInterval,
        nameservers: nameservers.trim() ? nameservers.split(",").map(ns => ns.trim()).filter(Boolean) : undefined,
        alert_threshold: alertThreshold,
        check_timeout: checkTimeout,
        enable_change_detection: enableChangeDetection,
      };

      console.log("Starting DNS monitoring with:", requestBody);
      console.log("Request URL:", `${API_BASE}/api/v1/dns/monitor`);

      const res = await fetch(`${API_BASE}/api/v1/dns/monitor`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Start monitoring response status:", res.status);

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errorData = await res.json();
          console.log("Error response data:", errorData);
          // Handle different error response formats
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
          } else if (errorData.message) {
            errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseErr) {
          console.error("Failed to parse error response:", parseErr);
          // If JSON parsing fails, use the status text
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("DNS monitoring started successfully:", data);
      setIsMonitoring(true);
      setSessionId(data.session_id);
      setMonitoringStatus(data);
    } catch (err) {
      console.error("Start monitoring error:", err);
      setErrorSafe(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!domain.trim()) {
        setErrorSafe("Domain is required to stop monitoring");
        setIsLoading(false);
        return;
      }

      console.log("Stopping DNS monitoring for domain:", domain.trim());
      
      const requestBody = {
        domain: domain.trim(),
      };
      
      console.log("Request body:", requestBody);
      console.log("Request body JSON:", JSON.stringify(requestBody));
      
      const res = await fetch(`${API_BASE}/api/v1/dns/monitor/stop`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Stop monitoring response status:", res.status);

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errorData = await res.json();
          console.log("Error response data:", errorData);
          // Handle different error response formats
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
          } else if (errorData.message) {
            errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (parseErr) {
          console.error("Failed to parse error response:", parseErr);
          // If JSON parsing fails, use the status text
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("Stop monitoring response data:", data);
      
      // Only update state if the stop was successful
      if (data.status === "stopped" || data.status === "not_found") {
        console.log("Monitoring stopped successfully");
        setIsMonitoring(false);
        setMonitoringStatus(null);
        setSessionId(null);
        setError(null);
      } else {
        const message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message || "Failed to stop monitoring");
        throw new Error(message);
      }
    } catch (err) {
      console.error("Stop monitoring error:", err);
      setErrorSafe(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll monitoring status
  useEffect(() => {
    if (!isMonitoring || !domain) return;
    
    let isMounted = true;
    
    const poll = async () => {
      if (!isMounted) return;
      
      try {
        const res = await fetch(`${API_BASE}/api/v1/dns/monitor/status/${domain}`);
        if (!isMounted) return;
        
        if (res.ok) {
          const data = await res.json();
          // If status indicates monitoring stopped, update local state
          if (data.status === "not_monitoring" || data.status === "stopped") {
            if (isMounted) {
              setIsMonitoring(false);
              setMonitoringStatus(null);
              setSessionId(null);
            }
            return;
          }
          if (isMounted) {
            setMonitoringStatus(data);
          }
        } else if (res.status === 404) {
          // Session not found, stop monitoring
          if (isMounted) {
            setIsMonitoring(false);
            setMonitoringStatus(null);
            setSessionId(null);
          }
        }
      } catch (err) {
        console.error("Error polling DNS status:", err);
        // Don't set error state from polling errors to avoid UI noise
      }
    };
    
    poll();
    const interval = setInterval(poll, 10000); // Poll every 10 seconds
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isMonitoring, domain]);

  // Prepare data for visualizations
  const getRecordDistributionData = () => {
    if (!monitoringStatus?.current_records) return [];
    return Object.entries(monitoringStatus.current_records).map(([type, records]: [string, any]) => ({
      name: type,
      count: Array.isArray(records) ? records.length : 0
    }));
  };

  const getRecordTypesData = () => {
    if (!monitoringStatus?.current_records) return [];
    return Object.keys(monitoringStatus.current_records);
  };

  const getTotalRecordsCount = () => {
    if (!monitoringStatus?.current_records) return 0;
    return Object.values(monitoringStatus.current_records).reduce((total: number, records: any) => {
      return total + (Array.isArray(records) ? records.length : 0);
    }, 0);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-0 md:p-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6" />
              DNS Monitoring
            </h1>
            {isMonitoring && domain && (
              <p className="text-sm text-muted-foreground mt-1">
                Monitoring: <span className="font-mono font-medium">{domain}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {/* New Scan button only shows when monitoring is active and results are shown */}
            {isMonitoring && monitoringStatus && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setDomain("");
                  setRecordTypes(["A", "AAAA", "MX", "TXT", "NS"]);
                  setMonitoringInterval("hourly");
                  setNameservers("");
                  setAlertThreshold(5);
                  setCheckTimeout(30);
                  setEnableChangeDetection(true);
                  setIsLoading(false);
                  setError(null);
                  setIsMonitoring(false);
                  setMonitoringStatus(null);
                  setSessionId(null);
                }}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            )}
          </div>
        </div>

        {/* Empty state when not monitoring */}
        {!isMonitoring && !monitoringStatus && (
          <div className="px-6 py-12 text-center">
            <Network className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Active Monitoring</h2>
            <p className="text-muted-foreground mb-6">
              Start monitoring from the right panel to track DNS record changes
            </p>
          </div>
        )}

        {/* Active monitoring content */}
        {isMonitoring && monitoringStatus && (
          <div className="px-6 space-y-6">
            {/* Export Dropdown - Top Right of Results */}
            <div className="flex justify-end mb-4">
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
                    onClick={() => {
                      // Export as JSON
                      const jsonStr = JSON.stringify(monitoringStatus, null, 2);
                      const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
                      const url = window.URL.createObjectURL(jsonBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `dns_monitoring_${domain}_${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Export as CSV
                      const csvRows: string[] = [];
                      // Header
                      csvRows.push('Record Type,Value,TTL');
                      // Data rows
                      if (monitoringStatus.current_records) {
                        Object.entries(monitoringStatus.current_records).forEach(([type, records]: [string, any]) => {
                          if (Array.isArray(records)) {
                            records.forEach((r: any) => {
                              csvRows.push(`${type},"${r.value}",${r.ttl || 'N/A'}`);
                            });
                          }
                        });
                      }
                      const csvContent = csvRows.join('\n');
                      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(csvBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `dns_monitoring_${domain}_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Monitoring Status</span>
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Monitoring active for <span className="font-mono font-semibold">{domain}</span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-primary">{getTotalRecordsCount()}</p>
                      <p className="text-xs text-muted-foreground">Total Records</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{getRecordTypesData().length}</p>
                      <p className="text-xs text-muted-foreground">Record Types</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {monitoringStatus.changes ? monitoringStatus.changes.length : 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Changes Detected</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DNS Record Distribution Chart */}
            {monitoringStatus?.current_records && Object.keys(monitoringStatus.current_records).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>DNS Record Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <DnsBarChart data={getRecordDistributionData()} />
                </CardContent>
              </Card>
            )}

            {/* Current DNS Records Table */}
            {monitoringStatus?.current_records && Object.keys(monitoringStatus.current_records).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Current DNS Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>TTL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(monitoringStatus.current_records).map(([type, records]: [string, any]) => 
                      Array.isArray(records) && records.map((r: any, idx: number) => (
                        <TableRow key={`${type}-${idx}`}>
                          <TableCell>
                            <Badge variant="outline">{type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{r.value}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.ttl ? `${r.ttl}s` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

            {/* DNS Changes Detected */}
            {monitoringStatus?.changes && monitoringStatus.changes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>DNS Changes Detected</span>
                    <Badge variant="destructive">{monitoringStatus.changes.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monitoringStatus.changes.map((change: any, idx: number) => (
                      <div key={idx} className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30">
                            {change.record_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{change.timestamp}</span>
                        </div>
                        {change.added.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Added:</p>
                            <div className="space-y-1">
                              {change.added.map((value: string, addIdx: number) => (
                                <p key={addIdx} className="text-xs font-mono text-green-600 dark:text-green-300">
                                  + {value}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {change.removed.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Removed:</p>
                            <div className="space-y-1">
                              {change.removed.map((value: string, remIdx: number) => (
                                <p key={remIdx} className="text-xs font-mono text-red-600 dark:text-red-300">
                                  - {value}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Baseline Records Comparison */}
            {monitoringStatus?.baseline_records && monitoringStatus?.current_records && (
              <Card>
                <CardHeader>
                  <CardTitle>Baseline Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Comparing current records against baseline established at: {monitoringStatus.started_at}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm font-semibold mb-2">Baseline Records</p>
                        <p className="text-2xl font-bold text-muted-foreground">
                          {Object.values(monitoringStatus.baseline_records).reduce((total: number, records: any) => {
                            return total + (Array.isArray(records) ? records.length : 0);
                          }, 0)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm font-semibold mb-2">Current Records</p>
                        <p className="text-2xl font-bold text-primary">
                          {getTotalRecordsCount()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
          <h2 className="text-lg font-semibold">DNS Monitoring</h2>
          <p className="text-xs text-gray-400">Configure and start</p>
        </header>

        {/* Domain input */}
        <div className="space-y-2">
          <Label htmlFor="domain" className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-300">
            <Network className="h-4 w-4" /> Domain
          </Label>
          <Input
            id="domain"
            value={domain}
            onChange={(e)=>setDomain(e.target.value)}
            placeholder="example.com"
            disabled={isLoading || isMonitoring}
            className="font-mono bg-gray-800 border-gray-700 placeholder:text-gray-500 text-sm"
          />
        </div>

        <Separator className="bg-gray-700" />

        {/* Record types selection */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-gray-300">Record Types</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableRecordTypes.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={type}
                  checked={recordTypes.includes(type)}
                  onChange={() => toggleRecordType(type)}
                  disabled={isLoading || isMonitoring}
                  className="rounded bg-gray-800 border-gray-700"
                />
                <Label htmlFor={type} className="text-xs text-gray-300 cursor-pointer">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Monitoring interval */}
        <div className="space-y-2">
          <Label htmlFor="interval" className="text-xs uppercase tracking-wide text-gray-300">
            Check Interval
          </Label>
          <select
            id="interval"
            value={monitoringInterval}
            onChange={(e)=>setMonitoringInterval(e.target.value)}
            disabled={isLoading || isMonitoring}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="realtime">Real-time</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <Separator className="bg-gray-700" />

        {/* Nameservers */}
        <div className="space-y-2">
          <Label htmlFor="nameservers" className="text-xs uppercase tracking-wide text-gray-300">
            Nameservers (Optional)
          </Label>
          <Input
            id="nameservers"
            value={nameservers}
            onChange={(e)=>setNameservers(e.target.value)}
            placeholder="8.8.8.8, 1.1.1.1"
            disabled={isLoading || isMonitoring}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">Comma-separated list</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Alert threshold */}
        <div className="space-y-2">
          <Label htmlFor="alertThreshold" className="text-xs uppercase tracking-wide text-gray-300">
            Alert Threshold (%)
          </Label>
          <Input
            id="alertThreshold"
            type="number"
            min="0"
            max="100"
            value={alertThreshold}
            onChange={(e)=>setAlertThreshold(parseInt(e.target.value) || 5)}
            disabled={isLoading || isMonitoring}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">Alert if change exceeds this %</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Check timeout */}
        <div className="space-y-2">
          <Label htmlFor="checkTimeout" className="text-xs uppercase tracking-wide text-gray-300">
            Check Timeout (seconds)
          </Label>
          <Input
            id="checkTimeout"
            type="number"
            min="5"
            max="300"
            value={checkTimeout}
            onChange={(e)=>setCheckTimeout(parseInt(e.target.value) || 30)}
            disabled={isLoading || isMonitoring}
            className="bg-gray-800 border-gray-700 text-sm"
          />
        </div>

        <Separator className="bg-gray-700" />

        {/* Change detection toggle */}
        <div className="flex items-center justify-between">
          <div className="text-sm">
            Change Detection<br/>
            <span className="text-xs text-gray-400">Alert on DNS changes</span>
          </div>
          <input
            type="checkbox"
            id="changeDetection"
            checked={enableChangeDetection}
            onChange={(e)=>setEnableChangeDetection(e.target.checked)}
            disabled={isLoading || isMonitoring}
            className="rounded bg-gray-800 border-gray-700"
          />
        </div>

        {error && (
          <div className="p-3 border border-red-500 rounded-lg bg-red-950/20">
            <p className="text-xs text-red-400">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </p>
          </div>
        )}

        {isMonitoring ? (
          <Button
            disabled={isLoading}
            onClick={handleStopMonitoring}
            variant="destructive"
            className="w-full mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                Stopping...
              </>
            ) : (
              <>Stop Monitoring</>
            )}
          </Button>
        ) : (
          <Button
            disabled={!domain.trim() || isLoading || recordTypes.length === 0}
            onClick={handleStartMonitoring}
            className="w-full mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                Starting...
              </>
            ) : (
              <>Start Monitoring</>
            )}
          </Button>
        )}
      </aside>
    </div>
  );
}
