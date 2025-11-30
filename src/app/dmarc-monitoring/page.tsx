"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DmarcPieChart } from "@/components/charts/DmarcPieChart";
import { mockDmarcData } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MailCheck, Loader2, Network } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const recentReports = [
    { source: 'google.com', count: 12543, policy: 'none', pass: '99.8%' },
    { source: 'outlook.com', count: 9876, policy: 'none', pass: '99.5%' },
    { source: 'yahoo.com', count: 5432, policy: 'quarantine', pass: '95.1%' },
    { source: 'icloud.com', count: 2109, policy: 'none', pass: '99.9%' },
    { source: 'some-esp.com', count: 876, policy: 'reject', pass: '80.2%' },
    { source: 'mailru.com', count: 451, policy: 'reject', pass: '75.4%' },
];

interface DMARCConfig {
  domain: string;
  email?: string;
  reportType: string;
  dateRange: string;
  reportSource?: string;
  aggregationPeriod: string;
}

export default function DmarcMonitoringPage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [reportType, setReportType] = useState("aggregate");
  const [dateRange, setDateRange] = useState("7");
  const [reportSource, setReportSource] = useState("");
  const [aggregationPeriod, setAggregationPeriod] = useState("daily");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleStartAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/v1/dmarc/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          email: email.trim() || undefined,
          report_type: reportType,
          date_range: dateRange,
          report_source: reportSource.trim() || undefined,
          aggregation_period: aggregationPeriod,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAnalysisResult(data);
      console.log("DMARC analysis completed:", data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start DMARC analysis");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-6 h-full">
        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle>DMARC Analysis Results</CardTitle>
              <CardDescription>Analysis for {analysisResult.domain}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground">DMARC Policy</p>
                  <p className="text-lg font-bold mt-1">{analysisResult.dmarc_policy?.policy || "Not configured"}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground">SPF Status</p>
                  <p className="text-lg font-bold mt-1">{analysisResult.spf?.valid ? "Valid" : "Invalid"}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground">DKIM Status</p>
                  <p className="text-lg font-bold mt-1">{analysisResult.dkim?.valid ? "Valid" : "Invalid"}</p>
                </div>
              </div>
              {analysisResult.dmarc_policy && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">DMARC Record</p>
                  <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto">
                    {JSON.stringify(analysisResult.dmarc_policy, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>DMARC Compliance</CardTitle>
              <CardDescription>Overall email compliance status from the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <DmarcPieChart data={mockDmarcData} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Aggregate Reports</CardTitle>
              <CardDescription>Summary of the latest DMARC reports received.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Reporting Source</TableHead>
                          <TableHead className="text-right">Email Count</TableHead>
                          <TableHead>Applied Policy</TableHead>
                          <TableHead className="text-right">Compliance</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {recentReports.map(report => (
                          <TableRow key={report.source}>
                              <TableCell className="font-medium">{report.source}</TableCell>
                              <TableCell className="text-right">{report.count.toLocaleString()}</TableCell>
                              <TableCell>
                                  <Badge variant={
                                      report.policy === 'reject' ? 'destructive' :
                                      report.policy === 'quarantine' ? 'secondary' : 'outline'
                                  }>{report.policy}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{report.pass}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
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
          <h2 className="text-lg font-semibold">DMARC Analysis</h2>
          <p className="text-xs text-gray-400">Configure and run</p>
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
            disabled={isLoading}
            className="font-mono bg-gray-800 border-gray-700 placeholder:text-gray-500 text-sm"
          />
        </div>

        <Separator className="bg-gray-700" />

        {/* Email input (optional) */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs uppercase tracking-wide text-gray-300 flex items-center gap-1">
            <MailCheck className="h-4 w-4"/>Email (Optional)
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="reports@example.com"
            disabled={isLoading}
            className="font-mono bg-gray-800 border-gray-700 placeholder:text-gray-500 text-sm"
          />
          <p className="text-xs text-gray-500">For fetching reports from email</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Report type */}
        <div className="space-y-2">
          <Label htmlFor="reportType" className="text-xs uppercase tracking-wide text-gray-300">
            Report Type
          </Label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e)=>setReportType(e.target.value)}
            disabled={isLoading}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="aggregate">Aggregate Reports</option>
            <option value="forensic">Forensic Reports</option>
            <option value="both">Both</option>
          </select>
        </div>

        <Separator className="bg-gray-700" />

        {/* Date range */}
        <div className="space-y-2">
          <Label htmlFor="dateRange" className="text-xs uppercase tracking-wide text-gray-300">
            Date Range (days)
          </Label>
          <Input
            id="dateRange"
            type="number"
            min="1"
            max="90"
            value={dateRange}
            onChange={(e)=>setDateRange(e.target.value)}
            disabled={isLoading}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">How many days back to analyze</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Report source */}
        <div className="space-y-2">
          <Label htmlFor="reportSource" className="text-xs uppercase tracking-wide text-gray-300">
            Report Source (Optional)
          </Label>
          <Input
            id="reportSource"
            value={reportSource}
            onChange={(e)=>setReportSource(e.target.value)}
            placeholder="google.com, outlook.com"
            disabled={isLoading}
            className="bg-gray-800 border-gray-700 text-sm"
          />
          <p className="text-xs text-gray-500">Filter by specific reporting source</p>
        </div>

        <Separator className="bg-gray-700" />

        {/* Aggregation period */}
        <div className="space-y-2">
          <Label htmlFor="aggregationPeriod" className="text-xs uppercase tracking-wide text-gray-300">
            Aggregation Period
          </Label>
          <select
            id="aggregationPeriod"
            value={aggregationPeriod}
            onChange={(e)=>setAggregationPeriod(e.target.value)}
            disabled={isLoading}
            className="w-full bg-gray-800 border-gray-700 text-sm rounded-md px-3 py-2 text-white"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {error && (
          <div className="p-3 border border-red-500 rounded-lg bg-red-950/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <Button
          disabled={!domain.trim() || isLoading}
          onClick={handleStartAnalysis}
          className="w-full mt-4"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
              Analyzing...
            </>
          ) : (
            <>Start Analysis</>
          )}
        </Button>
      </aside>
    </div>
  );
}
