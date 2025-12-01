"use client";

import { useState, Fragment } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DmarcPieChart } from "@/components/charts/DmarcPieChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MailCheck, Loader2, Network, Download, CheckCircle2, XCircle, AlertCircle, Shield } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
      if (!domain.trim()) {
        setError("Domain is required");
        setIsLoading(false);
        return;
      }

      // First, check if backend is accessible
      try {
        const healthCheck = await fetch(`${API_BASE}/health`, { method: "GET" });
        if (!healthCheck.ok) {
          throw new Error(`Backend health check failed: ${healthCheck.status} ${healthCheck.statusText}`);
        }
        console.log("Backend health check passed");
      } catch (healthErr) {
        const errorMsg = `Cannot connect to backend at ${API_BASE}. Please ensure the backend server is running. Error: ${healthErr instanceof Error ? healthErr.message : String(healthErr)}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const requestBody = {
        domain: domain.trim(),
        email: email.trim() || undefined,
        report_type: reportType,
        date_range: dateRange,
        report_source: reportSource.trim() || undefined,
        aggregation_period: aggregationPeriod,
      };

      console.log("Starting DMARC analysis with:", requestBody);
      console.log("Request URL:", `${API_BASE}/api/v1/dmarc/analyze`);
      console.log("API_BASE:", API_BASE);
      
      // Test if DMARC router is accessible
      try {
        const testRes = await fetch(`${API_BASE}/api/v1/dmarc/test`, { method: "GET" });
        if (testRes.ok) {
          const testData = await testRes.json();
          console.log("DMARC router test passed:", testData);
        } else {
          console.warn("DMARC router test failed:", testRes.status, testRes.statusText);
        }
      } catch (testErr) {
        console.warn("DMARC router test error:", testErr);
      }

      const res = await fetch(`${API_BASE}/api/v1/dmarc/analyze`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
      });

      console.log("DMARC analysis response status:", res.status);
      console.log("DMARC analysis response headers:", Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errorData = await res.json();
          console.log("Error response data:", errorData);
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
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log("DMARC analysis completed successfully:", data);
      setAnalysisResult(data);
    } catch (err) {
      console.error("DMARC analysis error:", err);
      const errorMessage = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Fragment>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-6 p-0 md:p-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              DMARC Monitoring
            </h1>
            {analysisResult && (
              <p className="text-sm text-muted-foreground mt-1">
                Analysis for: <span className="font-mono font-medium">{analysisResult.domain}</span>
              </p>
            )}
          </div>
        </div>

        {/* Empty state when no analysis */}
        {!analysisResult && (
          <div className="px-6 py-12 text-center">
            <MailCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Analysis Results</h2>
            <p className="text-muted-foreground mb-6">
              Start an analysis from the right panel to analyze DMARC policy and records
            </p>
          </div>
        )}

        {/* Analysis results */}
        {analysisResult && (
          <div className="px-6 space-y-6">
            <Card>
              <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>DMARC Analysis Results</CardTitle>
                  <CardDescription>Analysis for {analysisResult.domain}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Export results as JSON
                    const dataStr = JSON.stringify(analysisResult, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = window.URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `dmarc_analysis_${analysisResult.domain}_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(link);
                    link.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(link);
                  }}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </Button>
              </div>
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
                  <p className="text-lg font-bold mt-1">
                    {analysisResult.dkim?.valid ? "Valid Keys Found" : analysisResult.dkim?.records?.length > 0 ? "No Valid Keys" : "Not Found"}
                  </p>
                  {analysisResult.dkim?.selectors_found && analysisResult.dkim.selectors_found.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Found: {analysisResult.dkim.selectors_found.join(", ")}
                    </p>
                  )}
                  {!analysisResult.dkim?.valid && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                      <p className="text-yellow-800 dark:text-yellow-200 font-medium">⚠️ Limitation</p>
                      <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                        DKIM selectors are domain-specific. To verify, extract the selector from an email's DKIM-Signature header.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {analysisResult.dmarc_policy && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">DMARC Record</p>
                  <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto">
                    {analysisResult.dmarc_policy.record || JSON.stringify(analysisResult.dmarc_policy, null, 2)}
                  </pre>
                </div>
              )}

              {/* SPF Details */}
              {analysisResult.spf && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">SPF Record</p>
                    <Badge variant={analysisResult.spf.valid ? "default" : "destructive"}>
                      {analysisResult.spf.valid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                  <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto mt-2">
                    {analysisResult.spf.record || "No SPF record found"}
                  </pre>
                  {analysisResult.spf.dns_lookups !== undefined && (
                    <p className="text-xs text-muted-foreground mt-2">
                      DNS Lookups: {analysisResult.spf.dns_lookups}
                    </p>
                  )}
                </div>
              )}

              {/* DKIM Details */}
              {analysisResult.dkim && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">DKIM Validation</p>
                    <Badge variant={analysisResult.dkim.valid ? "default" : "secondary"}>
                      {analysisResult.dkim.valid ? "Valid Keys Found" : "Not Found"}
                    </Badge>
                  </div>
                  {analysisResult.dkim.total_selectors_checked && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Checked {analysisResult.dkim.total_selectors_checked} selector patterns
                    </p>
                  )}
                  {analysisResult.dkim.records && analysisResult.dkim.records.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium">DKIM Records Found:</p>
                      {analysisResult.dkim.records.map((record: any, idx: number) => (
                        <div key={idx} className="p-2 bg-muted rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-medium">{record.selector}</span>
                            <Badge variant={record.valid ? "default" : "secondary"} className="text-xs">
                              {record.valid ? "Valid" : "No Key"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground font-mono truncate">
                            {record.query}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        No DKIM records found for checked selectors
                      </p>
                      {analysisResult.dkim.limitation && (
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                          <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-1">⚠️ Important Note</p>
                          <p className="text-yellow-700 dark:text-yellow-300">
                            {analysisResult.dkim.limitation}
                          </p>
                          {analysisResult.dkim.recommendation && (
                            <p className="text-yellow-700 dark:text-yellow-300 mt-1 font-mono text-[10px]">
                              {analysisResult.dkim.recommendation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DMARC Report Addresses */}
              {analysisResult.dmarc_policy?.rua && analysisResult.dmarc_policy.rua.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Aggregate Report Addresses (RUA)</p>
                  <div className="space-y-1">
                    {analysisResult.dmarc_policy.rua.map((addr: string, idx: number) => (
                      <p key={idx} className="text-xs font-mono text-muted-foreground">
                        {addr}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.dmarc_policy?.ruf && analysisResult.dmarc_policy.ruf.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-medium mb-2">Forensic Report Addresses (RUF)</p>
                  <div className="space-y-1">
                    {analysisResult.dmarc_policy.ruf.map((addr: string, idx: number) => (
                      <p key={idx} className="text-xs font-mono text-muted-foreground">
                        {addr}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visualization Section */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* DMARC Policy Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle>DMARC Policy Status</CardTitle>
                <CardDescription>Current DMARC policy configuration</CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult.dmarc_policy ? (
                  <DmarcPieChart data={[
                    {
                      name: analysisResult.dmarc_policy.policy || "none",
                      value: analysisResult.dmarc_policy.pct || 100,
                      fill: analysisResult.dmarc_policy.policy === "reject" ? "#ef4444" :
                            analysisResult.dmarc_policy.policy === "quarantine" ? "#f59e0b" :
                            "#6b7280"
                    }
                  ]} />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No DMARC policy configured
                  </div>
                )}
                {analysisResult.dmarc_policy && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Policy:</span>
                      <Badge variant={
                        analysisResult.dmarc_policy.policy === "reject" ? "destructive" :
                        analysisResult.dmarc_policy.policy === "quarantine" ? "secondary" : "outline"
                      }>
                        {analysisResult.dmarc_policy.policy || "none"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Percentage:</span>
                      <span className="font-medium">{analysisResult.dmarc_policy.pct || 100}%</span>
                    </div>
                    {analysisResult.dmarc_policy.subdomain_policy && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Subdomain Policy:</span>
                        <Badge variant="outline">{analysisResult.dmarc_policy.subdomain_policy}</Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Authentication Status */}
            <Card>
              <CardHeader>
                <CardTitle>Email Authentication Status</CardTitle>
                <CardDescription>SPF and DKIM validation results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {analysisResult.spf?.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium">SPF</span>
                    </div>
                    <Badge variant={analysisResult.spf?.valid ? "default" : "destructive"}>
                      {analysisResult.spf?.valid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {analysisResult.dkim?.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="text-sm font-medium">DKIM</span>
                    </div>
                    <Badge variant={analysisResult.dkim?.valid ? "default" : "secondary"}>
                      {analysisResult.dkim?.valid ? "Valid" : "Unknown"}
                    </Badge>
                  </div>
                  {!analysisResult.dkim?.valid && (
                    <div className="mt-2 px-3 pb-2">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium mb-1">
                        ⚠️ Selector Discovery Limited
                      </p>
                      <p className="text-xs text-muted-foreground">
                        DKIM selectors are domain-specific. Extract selector from email's DKIM-Signature header (s= tag) to verify.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {analysisResult.dmarc_policy?.valid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium">DMARC</span>
                    </div>
                    <Badge variant={analysisResult.dmarc_policy?.valid ? "default" : "destructive"}>
                      {analysisResult.dmarc_policy?.valid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DKIM Selectors Table */}
            {analysisResult.dkim && (
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>DKIM Selectors</CardTitle>
                  <CardDescription>DKIM selectors checked and found</CardDescription>
                </CardHeader>
                <CardContent>
                  {analysisResult.dkim.selectors_found && analysisResult.dkim.selectors_found.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Selector</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisResult.dkim.records?.map((record: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{record.selector}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={record.valid ? "default" : "secondary"} className="text-xs">
                                {record.valid ? "Valid" : "No Key"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No DKIM selectors found</p>
                      <p className="text-xs mt-1">
                        Checked: {analysisResult.dkim.selectors_checked?.join(", ") || "N/A"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
    </Fragment>
  );
}
