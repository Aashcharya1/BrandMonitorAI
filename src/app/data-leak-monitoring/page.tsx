"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, 
  Search, 
  Shield,
  AlertTriangle,
  CheckCircle2, 
  XCircle, 
  Loader2,
  Mail,
  Globe,
  Key,
  GitBranch,
  Eye,
  Lock,
  Server,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Download
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BreachResult {
  name: string;
  title: string;
  domain: string;
  breach_date: string;
  pwn_count: number;
  data_classes: string[];
  is_verified: boolean;
  is_sensitive: boolean;
  description?: string;
}

interface PasswordCheckResult {
  pwned: boolean;
  count: number;
  safe: boolean;
  message: string;
  recommendation?: string;
}

interface ExposedDatabaseFinding {
  type: string;
  title: string;
  description: string;
  severity: string;
  ip: string;
  port: number;
  database_type: string;
  hostnames: string[];
  org: string;
  country: string;
  vulnerabilities: string[];
}

interface SecretFinding {
  type: string;
  title: string;
  severity: string;
  detector: string;
  verified: boolean;
  redacted: string;
  file: string;
  commit: string;
}

type ScanType = "email" | "password" | "domain" | "databases" | "secrets" | null;

export default function DataLeakMonitoringPage() {
  const [activeScan, setActiveScan] = useState<ScanType>(null);
  
  // Email breach check
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    breach_count: number;
    paste_count: number;
    risk_score: number;
    risk_level: string;
    breaches: BreachResult[];
  } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password check
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordResult, setPasswordResult] = useState<PasswordCheckResult | null>(null);

  // Domain breach check
  const [domain, setDomain] = useState("");
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainResult, setDomainResult] = useState<{
    breach_count: number;
    total_records_exposed: number;
    breaches: BreachResult[];
  } | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Exposed database scan
  const [dbScanDomain, setDbScanDomain] = useState("");
  const [dbScanOrg, setDbScanOrg] = useState("");
  const [dbScanLoading, setDbScanLoading] = useState(false);
  const [dbScanResult, setDbScanResult] = useState<{
    total_findings: number;
    severity_summary: Record<string, number>;
    findings: ExposedDatabaseFinding[];
  } | null>(null);
  const [dbScanError, setDbScanError] = useState<string | null>(null);
  const [selectedDbTypes, setSelectedDbTypes] = useState<string[]>([
    "mongodb", "elasticsearch", "redis", "couchdb"
  ]);

  // Repository secret scan
  const [repoUrl, setRepoUrl] = useState("");
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoResult, setRepoResult] = useState<{
    total_findings: number;
    severity_summary: Record<string, number>;
    findings: SecretFinding[];
  } | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);

  const dbTypeOptions = [
    { value: "mongodb", label: "MongoDB" },
    { value: "elasticsearch", label: "Elasticsearch" },
    { value: "redis", label: "Redis" },
    { value: "couchdb", label: "CouchDB" },
    { value: "cassandra", label: "Cassandra" },
    { value: "jenkins", label: "Jenkins" },
    { value: "gitlab", label: "GitLab" },
    { value: "kibana", label: "Kibana" },
  ];

  const checkEmailBreaches = async () => {
    if (!email.trim()) return;
    setEmailLoading(true);
    setEmailError(null);
    setEmailResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/data-leaks/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(),
          include_unverified: false,
          include_pastes: true
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setEmailResult(data);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to check email");
    } finally {
      setEmailLoading(false);
    }
  };

  const checkPassword = async () => {
    if (!password) return;
    setPasswordLoading(true);
    setPasswordResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/data-leaks/check-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setPasswordResult(data);
    } catch (err) {
      console.error("Password check failed:", err);
    } finally {
      setPasswordLoading(false);
    }
  };

  const checkDomainBreaches = async () => {
    if (!domain.trim()) return;
    setDomainLoading(true);
    setDomainError(null);
    setDomainResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/data-leaks/check-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setDomainResult(data);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Failed to check domain");
    } finally {
      setDomainLoading(false);
    }
  };

  const scanExposedDatabases = async () => {
    if (!dbScanDomain.trim() && !dbScanOrg.trim()) return;
    setDbScanLoading(true);
    setDbScanError(null);
    setDbScanResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/data-leaks/scan-databases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          domain: dbScanDomain.trim() || null,
          org: dbScanOrg.trim() || null,
          db_types: selectedDbTypes,
          limit: 100
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setDbScanResult(data);
    } catch (err) {
      setDbScanError(err instanceof Error ? err.message : "Failed to scan databases");
    } finally {
      setDbScanLoading(false);
    }
  };

  const scanRepositorySecrets = async () => {
    if (!repoUrl.trim()) return;
    setRepoLoading(true);
    setRepoError(null);
    setRepoResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/data-leaks/scan-repository`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(),
          max_depth: 100
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setRepoResult(data);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : "Failed to scan repository");
    } finally {
      setRepoLoading(false);
    }
  };

  const exportToCSV = () => {
    const rows: string[][] = [];
    
    // Add header
    rows.push(["Type", "Target", "Date", "Details", "Severity/Risk"]);
    
    // Add email breach results
    if (emailResult?.breaches) {
      emailResult.breaches.forEach(breach => {
        rows.push([
          "Email Breach",
          email,
          breach.breach_date,
          `${breach.title} - ${breach.data_classes.join(", ")}`,
          emailResult.risk_level
        ]);
      });
    }
    
    // Add domain breach results
    if (domainResult?.breaches) {
      domainResult.breaches.forEach(breach => {
        rows.push([
          "Domain Breach",
          domain,
          breach.breach_date,
          `${breach.title} - ${breach.pwn_count.toLocaleString()} records`,
          "N/A"
        ]);
      });
    }
    
    // Add database scan results
    if (dbScanResult?.findings) {
      dbScanResult.findings.forEach(finding => {
        rows.push([
          "Exposed Database",
          `${finding.ip}:${finding.port}`,
          new Date().toISOString().split('T')[0],
          `${finding.database_type} - ${finding.org || "Unknown"}`,
          finding.severity
        ]);
      });
    }
    
    // Add repository secrets results
    if (repoResult?.findings) {
      repoResult.findings.forEach(finding => {
        rows.push([
          "Repository Secret",
          finding.file || "Unknown",
          new Date().toISOString().split('T')[0],
          `${finding.detector} - ${finding.redacted}`,
          finding.severity
        ]);
      });
    }
    
    if (rows.length === 1) {
      alert("No data to export. Run some scans first!");
      return;
    }
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    
    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `data-leak-scan-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "bg-red-600 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black";
      case "low": return "bg-blue-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical": return "text-red-600";
      case "high": return "text-orange-500";
      case "medium": return "text-yellow-600";
      case "low": return "text-green-600";
      default: return "text-gray-500";
    }
  };

  const scanOptions = [
    { 
      id: "email" as ScanType, 
      label: "Email Breach Check", 
      icon: Mail, 
      description: "Check if email was exposed in breaches",
      color: "text-blue-500"
    },
    { 
      id: "password" as ScanType, 
      label: "Password Check", 
      icon: Key, 
      description: "Check if password was compromised",
      color: "text-purple-500"
    },
    { 
      id: "domain" as ScanType, 
      label: "Domain Breaches", 
      icon: Globe, 
      description: "Check domain breach history",
      color: "text-green-500"
    },
    { 
      id: "databases" as ScanType, 
      label: "Exposed Databases", 
      icon: Server, 
      description: "Scan for exposed databases",
      color: "text-orange-500"
    },
    { 
      id: "secrets" as ScanType, 
      label: "Repository Secrets", 
      icon: GitBranch, 
      description: "Scan repos for leaked secrets",
      color: "text-red-500"
    },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main Content Area - Results */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Data Leak Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check for breached credentials, exposed databases, and leaked secrets
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Security Status</p>
                  <p className="text-2xl font-bold text-green-500">Protected</p>
                </div>
                <ShieldCheck className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scans Today</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {(emailResult ? 1 : 0) + (passwordResult ? 1 : 0) + (domainResult ? 1 : 0)}
                  </p>
                </div>
                <Activity className="h-10 w-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Breaches Found</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {(emailResult?.breach_count || 0) + (domainResult?.breach_count || 0)}
                  </p>
                </div>
                <ShieldAlert className="h-10 w-10 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exposed Records</p>
                  <p className="text-2xl font-bold text-red-500">
                    {(domainResult?.total_records_exposed || 0).toLocaleString()}
                  </p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Area */}
        {!activeScan && !emailResult && !passwordResult && !domainResult && !dbScanResult && !repoResult && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Database className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Scans Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Select a scan type from the right panel to check for data leaks, 
                breached credentials, or exposed databases.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Email Results */}
        {emailResult && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Email Breach Results: {email}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className={`text-3xl font-bold ${getRiskColor(emailResult.risk_level)}`}>
                    {emailResult.risk_score}
                  </p>
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <Badge className={`mt-2 ${getSeverityColor(emailResult.risk_level)}`}>
                    {emailResult.risk_level.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-red-600">{emailResult.breach_count}</p>
                  <p className="text-sm text-muted-foreground">Breaches</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-orange-500">{emailResult.paste_count}</p>
                  <p className="text-sm text-muted-foreground">Pastes</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  {emailResult.breach_count === 0 ? (
                    <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
                  ) : (
                    <AlertTriangle className="h-10 w-10 text-red-600 mx-auto" />
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {emailResult.breach_count === 0 ? "Safe" : "At Risk"}
                  </p>
                </div>
              </div>
              
              {emailResult.breaches.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Breach</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Data Exposed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailResult.breaches.map((breach, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{breach.title}</TableCell>
                        <TableCell>{breach.breach_date}</TableCell>
                        <TableCell>{breach.pwn_count.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {breach.data_classes.slice(0, 3).map((dc, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{dc}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Password Results */}
        {passwordResult && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-purple-500" />
                Password Check Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`p-6 rounded-lg ${passwordResult.pwned ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                <div className="flex items-center gap-4">
                  {passwordResult.pwned ? (
                    <XCircle className="h-12 w-12 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  )}
                  <div>
                    <p className={`text-xl font-bold ${passwordResult.pwned ? 'text-red-600' : 'text-green-600'}`}>
                      {passwordResult.pwned ? `Password Compromised!` : 'Password Not Found'}
                    </p>
                    <p className="text-sm text-muted-foreground">{passwordResult.message}</p>
                    {passwordResult.pwned && (
                      <p className="text-sm mt-2 font-medium text-red-600">
                        Found in {passwordResult.count.toLocaleString()} data breaches
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Domain Results */}
        {domainResult && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" />
                Domain Breach Results: {domain}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-red-600">{domainResult.breach_count}</p>
                  <p className="text-sm text-muted-foreground">Breaches Found</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold text-orange-500">
                    {domainResult.total_records_exposed.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Records Exposed</p>
                </div>
              </div>

              {domainResult.breaches.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Breach</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Data Types</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domainResult.breaches.map((breach, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{breach.title}</TableCell>
                        <TableCell>{breach.breach_date}</TableCell>
                        <TableCell>{breach.pwn_count.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {breach.data_classes.slice(0, 3).map((dc, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{dc}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Database Scan Results */}
        {dbScanResult && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-orange-500" />
                Exposed Database Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{dbScanResult.total_findings}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{dbScanResult.severity_summary.critical || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-500/10">
                  <p className="text-2xl font-bold text-orange-500">{dbScanResult.severity_summary.high || 0}</p>
                  <p className="text-xs text-muted-foreground">High</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{dbScanResult.severity_summary.medium || 0}</p>
                  <p className="text-xs text-muted-foreground">Medium</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-600">{dbScanResult.severity_summary.low || 0}</p>
                  <p className="text-xs text-muted-foreground">Low</p>
                </div>
              </div>

              {dbScanResult.findings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>IP:Port</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbScanResult.findings.map((finding, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{finding.database_type?.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{finding.ip}:{finding.port}</TableCell>
                        <TableCell>{finding.org || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(finding.severity)}>
                            {finding.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-600">No Exposed Databases Found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Repository Secrets Results */}
        {repoResult && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-red-500" />
                Repository Secrets Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{repoResult.total_findings || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Secrets</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{repoResult.severity_summary?.critical || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-500/10">
                  <p className="text-2xl font-bold text-orange-500">{repoResult.severity_summary?.high || 0}</p>
                  <p className="text-xs text-muted-foreground">High</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{repoResult.severity_summary?.medium || 0}</p>
                  <p className="text-xs text-muted-foreground">Medium</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-600">{repoResult.severity_summary?.low || 0}</p>
                  <p className="text-xs text-muted-foreground">Low</p>
                </div>
              </div>

              {repoResult.findings?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repoResult.findings?.map((finding, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{finding.detector}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[200px]">
                          {finding.file || "Unknown"}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[150px]">
                          {finding.redacted || "***"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(finding.severity)}>
                            {finding.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-600">No Secrets Found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error displays */}
        {emailError && (
          <Card className="mb-4 border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <p>{emailError}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {domainError && (
          <Card className="mb-4 border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <p>{domainError}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {dbScanError && (
          <Card className="mb-4 border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <p>{dbScanError}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {repoError && (
          <Card className="mb-4 border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <p>{repoError}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel - Scan Options */}
      <div className="w-96 border-l bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-2 text-white">
              <Search className="h-4 w-4" />
              Scan Options
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:text-white"
            >
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
          </div>
          <p className="text-xs text-slate-400">Select a scan type to check for leaks</p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {scanOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setActiveScan(activeScan === option.id ? null : option.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  activeScan === option.id 
                    ? 'bg-primary/20 border-primary' 
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <option.icon className={`h-5 w-5 ${option.color}`} />
                    <div>
                      <p className="font-medium text-sm text-white">{option.label}</p>
                      <p className="text-xs text-slate-400">{option.description}</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${activeScan === option.id ? 'rotate-90' : ''}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Scan Input Forms */}
          <div className="p-4 border-t border-slate-700">
            {activeScan === "email" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Email Address</Label>
                  <Input
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkEmailBreaches()}
                    className="mt-1"
                  />
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 text-xs">
                  <p className="font-medium text-blue-600">HaveIBeenPwned API</p>
                  <p className="text-muted-foreground">Requires HIBP_API_KEY in backend</p>
                </div>
                <Button onClick={checkEmailBreaches} disabled={emailLoading || !email.trim()} className="w-full">
                  {emailLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Check Email
                </Button>
              </div>
            )}

            {activeScan === "password" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter password to check"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkPassword()}
                    className="mt-1"
                  />
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <p className="font-medium text-green-600">Privacy Protected</p>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Only a partial hash is sent - your password never leaves your device.
                  </p>
                </div>
                <Button onClick={checkPassword} disabled={passwordLoading || !password} className="w-full">
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Check Password
                </Button>
              </div>
            )}

            {activeScan === "domain" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Domain</Label>
                  <Input
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkDomainBreaches()}
                    className="mt-1"
                  />
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 text-xs">
                  <p className="font-medium text-blue-600">HaveIBeenPwned API</p>
                  <p className="text-muted-foreground">Requires HIBP_API_KEY in backend</p>
                </div>
                <Button onClick={checkDomainBreaches} disabled={domainLoading || !domain.trim()} className="w-full">
                  {domainLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Check Domain
                </Button>
              </div>
            )}

            {activeScan === "databases" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Domain (optional)</Label>
                  <Input
                    placeholder="example.com"
                    value={dbScanDomain}
                    onChange={(e) => setDbScanDomain(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white">Organization (optional)</Label>
                  <Input
                    placeholder="Company Inc."
                    value={dbScanOrg}
                    onChange={(e) => setDbScanOrg(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white">Database Types</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {dbTypeOptions.slice(0, 4).map((opt) => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={opt.value}
                          checked={selectedDbTypes.includes(opt.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDbTypes([...selectedDbTypes, opt.value]);
                            } else {
                              setSelectedDbTypes(selectedDbTypes.filter(t => t !== opt.value));
                            }
                          }}
                        />
                        <label htmlFor={opt.value} className="text-xs text-white">{opt.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 text-xs">
                  <p className="font-medium text-orange-600">Shodan API</p>
                  <p className="text-muted-foreground">Requires SHODAN_API_KEY in backend</p>
                </div>
                <Button 
                  onClick={scanExposedDatabases} 
                  disabled={dbScanLoading || (!dbScanDomain.trim() && !dbScanOrg.trim())} 
                  className="w-full"
                >
                  {dbScanLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  Scan Databases
                </Button>
              </div>
            )}

            {activeScan === "secrets" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Repository URL</Label>
                  <Input
                    placeholder="https://github.com/user/repo.git"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && scanRepositorySecrets()}
                    className="mt-1"
                  />
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="font-medium text-emerald-600">TruffleHog3 Ready</p>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Scans for API keys, passwords, tokens, and other secrets in git history
                  </p>
                </div>
                <Button onClick={scanRepositorySecrets} disabled={repoLoading || !repoUrl.trim()} className="w-full">
                  {repoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
                  Scan Repository
                </Button>
              </div>
            )}

            {!activeScan && (
              <div className="text-center py-8 text-slate-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a scan type above to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
