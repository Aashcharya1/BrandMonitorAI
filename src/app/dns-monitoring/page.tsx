"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DnsBarChart } from "@/components/charts/DnsBarChart";
import { mockDnsData } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Network, Loader2, CheckCircle2, XCircle } from "lucide-react";

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
      const res = await fetch(`${API_BASE}/api/v1/dns/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          record_types: recordTypes,
          interval: monitoringInterval,
          nameservers: nameservers.trim() ? nameservers.split(",").map(ns => ns.trim()).filter(Boolean) : undefined,
          alert_threshold: alertThreshold,
          check_timeout: checkTimeout,
          enable_change_detection: enableChangeDetection,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setIsMonitoring(true);
      setSessionId(data.session_id);
      setMonitoringStatus(data);
      console.log("DNS monitoring started:", data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start DNS monitoring");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/v1/dns/monitor/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      setIsMonitoring(false);
      setMonitoringStatus(null);
      setSessionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop DNS monitoring");
    } finally {
      setIsLoading(false);
    }
  };

  // Poll monitoring status
  useEffect(() => {
    if (!isMonitoring || !domain) return;
    
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/dns/monitor/status/${domain}`);
        if (res.ok) {
          const data = await res.json();
          setMonitoringStatus(data);
        }
      } catch (err) {
        console.error("Error polling DNS status:", err);
      }
    };
    
    poll();
    const interval = setInterval(poll, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, [isMonitoring, domain]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-6 h-full">
        <Card>
          <CardHeader>
            <CardTitle>DNS Record Distribution</CardTitle>
          </CardHeader>
          <CardContent>
             <DnsBarChart data={mockDnsData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>DNS Change History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isMonitoring ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Monitoring active for {domain}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  <span>No active monitoring</span>
                </div>
              )}
              {monitoringStatus && monitoringStatus.current_records && (
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Current DNS Records</p>
                    {Object.entries(monitoringStatus.current_records).map(([type, records]: [string, any]) => (
                      <div key={type} className="mb-2">
                        <p className="text-xs font-semibold text-muted-foreground">{type} Records:</p>
                        <div className="ml-4 space-y-1">
                          {records.map((r: any, idx: number) => (
                            <p key={idx} className="text-xs font-mono">{r.value}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {monitoringStatus.changes && monitoringStatus.changes.length > 0 && (
                    <div className="p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">DNS Changes Detected</p>
                      {monitoringStatus.changes.map((change: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <p className="font-semibold">{change.record_type}:</p>
                          {change.added.length > 0 && (
                            <p className="text-green-600">+ {change.added.join(", ")}</p>
                          )}
                          {change.removed.length > 0 && (
                            <p className="text-red-600">- {change.removed.join(", ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                DNS monitoring tracks changes to DNS records and alerts when unauthorized changes are detected.
              </p>
            </div>
          </CardContent>
        </Card>
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
            <p className="text-xs text-red-400">{error}</p>
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
