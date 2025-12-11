"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield,
  AlertTriangle,
  CheckCircle2, 
  XCircle, 
  Loader2,
  Globe,
  Search,
  Target,
  FileText,
  Send,
  Plus,
  RefreshCw,
  ExternalLink,
  Copy,
  Users,
  TrendingUp,
  Eye,
  ChevronRight,
  ChevronDown,
  Download
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE = process.env.NEXT_PUBLIC_MONITOR_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Threat {
  id: string;
  threat_type: string;
  platform: string;
  target: string;
  brand_affected: string;
  similarity_score: number;
  risk_level: string;
  status: string;
  detected_at: string;
  evidence?: Record<string, unknown>;
}

interface Brand {
  brand_name: string;
  domains: string[];
  keywords: string[];
  social_handles: Record<string, string>;
  typosquat_patterns_count: number;
}

interface TakedownRequest {
  id: string;
  threat_id: string;
  platform: string;
  target: string;
  request_type: string;
  status: string;
  submitted_at?: string;
}

type ScanType = "domain" | "bulk" | "social" | "brand" | null;

export default function TakedownMonitoringPage() {
  // State for active scan type (right panel)
  const [activeScan, setActiveScan] = useState<ScanType>(null);
  
  // State for brands
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrand, setNewBrand] = useState({
    brand_name: "",
    domains: "",
    keywords: "",
    social_handles: ""
  });
  
  // State for threats
  const [threats, setThreats] = useState<Threat[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  
  // State for domain checking
  const [domainToCheck, setDomainToCheck] = useState("");
  const [domainCheckResult, setDomainCheckResult] = useState<Record<string, unknown> | null>(null);
  
  // State for bulk scan
  const [bulkDomains, setBulkDomains] = useState("");
  
  // State for social media check
  const [socialBrand, setSocialBrand] = useState("");
  
  // State for takedown requests
  const [takedownRequests, setTakedownRequests] = useState<TakedownRequest[]>([]);
  
  // State for generated report
  const [generatedReport, setGeneratedReport] = useState("");
  
  // Loading states
  const [loading, setLoading] = useState({
    brands: false,
    threats: false,
    domainCheck: false,
    bulkScan: false,
    socialCheck: false,
    report: false,
    addBrand: false
  });
  
  // Summary stats
  const [summary, setSummary] = useState({
    total_threats: 0,
    total_takedown_requests: 0,
    by_status: {} as Record<string, number>,
    by_type: {} as Record<string, number>,
    by_risk_level: {} as Record<string, number>,
    takedown_success_rate: 0
  });

  // Load data on mount
  useEffect(() => {
    loadBrands();
    loadThreats();
    loadSummary();
    loadTakedownRequests();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(prev => ({ ...prev, brands: true }));
      const res = await fetch(`${API_BASE}/api/v1/takedown/brands`);
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error("Error loading brands:", error);
    } finally {
      setLoading(prev => ({ ...prev, brands: false }));
    }
  };

  const loadThreats = async () => {
    try {
      setLoading(prev => ({ ...prev, threats: true }));
      const res = await fetch(`${API_BASE}/api/v1/takedown/threats`);
      if (res.ok) {
        const data = await res.json();
        setThreats(data.threats || []);
      }
    } catch (error) {
      console.error("Error loading threats:", error);
    } finally {
      setLoading(prev => ({ ...prev, threats: false }));
    }
  };

  const loadSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/takedown/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Error loading summary:", error);
    }
  };

  const loadTakedownRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/takedown/requests`);
      if (res.ok) {
        const data = await res.json();
        setTakedownRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Error loading takedown requests:", error);
    }
  };

  const addBrand = async () => {
    if (!newBrand.brand_name || !newBrand.domains) return;
    
    try {
      setLoading(prev => ({ ...prev, addBrand: true }));
      const res = await fetch(`${API_BASE}/api/v1/takedown/brands/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: newBrand.brand_name,
          domains: newBrand.domains.split(",").map(d => d.trim()),
          keywords: newBrand.keywords.split(",").map(k => k.trim()).filter(k => k),
          social_handles: newBrand.social_handles ? 
            Object.fromEntries(
              newBrand.social_handles.split(",").map(h => {
                const [platform, handle] = h.split(":").map(s => s.trim());
                return [platform, handle];
              })
            ) : {}
        })
      });
      
      if (res.ok) {
        setNewBrand({ brand_name: "", domains: "", keywords: "", social_handles: "" });
        loadBrands();
        setActiveScan(null);
      }
    } catch (error) {
      console.error("Error adding brand:", error);
    } finally {
      setLoading(prev => ({ ...prev, addBrand: false }));
    }
  };

  const checkDomain = async () => {
    if (!domainToCheck) return;
    
    try {
      setLoading(prev => ({ ...prev, domainCheck: true }));
      setDomainCheckResult(null);
      
      const res = await fetch(`${API_BASE}/api/v1/takedown/check-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainToCheck })
      });
      
      if (res.ok) {
        const data = await res.json();
        setDomainCheckResult(data);
        if (data.is_threat) {
          loadThreats();
          loadSummary();
        }
      }
    } catch (error) {
      console.error("Error checking domain:", error);
    } finally {
      setLoading(prev => ({ ...prev, domainCheck: false }));
    }
  };

  const scanBulkDomains = async () => {
    if (!bulkDomains) return;
    
    try {
      setLoading(prev => ({ ...prev, bulkScan: true }));
      
      const domains = bulkDomains.split("\n").map(d => d.trim()).filter(d => d);
      
      const res = await fetch(`${API_BASE}/api/v1/takedown/scan-domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Scanned ${data.total_scanned} domains. Found ${data.threats_found} threats.`);
        loadThreats();
        loadSummary();
        setBulkDomains("");
      }
    } catch (error) {
      console.error("Error scanning domains:", error);
    } finally {
      setLoading(prev => ({ ...prev, bulkScan: false }));
    }
  };

  const checkSocialMedia = async () => {
    if (!socialBrand) return;
    
    try {
      setLoading(prev => ({ ...prev, socialCheck: true }));
      
      const res = await fetch(`${API_BASE}/api/v1/takedown/check-social-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: socialBrand })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Checked social media for ${socialBrand}. Found ${data.threats_found} potential fake profiles.`);
        loadThreats();
        loadSummary();
      }
    } catch (error) {
      console.error("Error checking social media:", error);
    } finally {
      setLoading(prev => ({ ...prev, socialCheck: false }));
    }
  };

  const generateReport = async (threatId: string, reportType: string) => {
    try {
      setLoading(prev => ({ ...prev, report: true }));
      
      const res = await fetch(`${API_BASE}/api/v1/takedown/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          threat_id: threatId, 
          report_type: reportType 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setGeneratedReport(data.report_content);
      }
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(prev => ({ ...prev, report: false }));
    }
  };

  const createTakedownRequest = async (threatId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/takedown/create-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          threat_id: threatId,
          request_type: "abuse_report"
        })
      });
      
      if (res.ok) {
        alert("Takedown request created successfully!");
        loadThreats();
        loadTakedownRequests();
        loadSummary();
      }
    } catch (error) {
      console.error("Error creating takedown request:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const exportToCSV = () => {
    const rows: string[][] = [];
    
    // Add header
    rows.push(["Target", "Type", "Brand Affected", "Platform", "Risk Level", "Status", "Detected At"]);
    
    // Add threats
    threats.forEach(threat => {
      rows.push([
        threat.target,
        threat.threat_type.replace(/_/g, " "),
        threat.brand_affected,
        threat.platform,
        threat.risk_level,
        threat.status.replace(/_/g, " "),
        threat.detected_at
      ]);
    });
    
    if (rows.length === 1) {
      alert("No threats to export. Run some scans first!");
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
    link.download = `takedown-threats-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-black",
      low: "bg-blue-500 text-white"
    };
    return <Badge className={colors[risk] || "bg-gray-500"}>{risk.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      detected: "bg-yellow-500/20 text-yellow-600 border-yellow-500",
      investigating: "bg-blue-500/20 text-blue-600 border-blue-500",
      takedown_requested: "bg-purple-500/20 text-purple-600 border-purple-500",
      takedown_pending: "bg-orange-500/20 text-orange-600 border-orange-500",
      takedown_completed: "bg-green-500/20 text-green-600 border-green-500",
      false_positive: "bg-gray-500/20 text-gray-600 border-gray-500"
    };
    return (
      <Badge variant="outline" className={colors[status] || ""}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  const scanOptions = [
    {
      id: "domain" as ScanType,
      title: "Domain Check",
      description: "Check if a domain is a phishing threat",
      icon: Globe,
      color: "text-blue-500"
    },
    {
      id: "bulk" as ScanType,
      title: "Bulk Scan",
      description: "Scan multiple domains at once",
      icon: Search,
      color: "text-purple-500"
    },
    {
      id: "social" as ScanType,
      title: "Social Media Check",
      description: "Find fake profiles impersonating brands",
      icon: Users,
      color: "text-pink-500"
    },
    {
      id: "brand" as ScanType,
      title: "Add Brand",
      description: "Configure a new brand for monitoring",
      icon: Target,
      color: "text-green-500"
    }
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-500" />
            Takedown Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor phishing domains, fake profiles, and manage takedown requests
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Security Status</p>
                  <p className="text-lg font-bold text-green-500">Protected</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Scans Today</p>
                  <p className="text-2xl font-bold text-blue-500">{summary.total_threats}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Threats Found</p>
                  <p className="text-2xl font-bold text-red-500">{threats.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending Takedowns</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {summary.by_status?.takedown_pending || 0}
                  </p>
                </div>
                <Send className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Detected Threats
            </CardTitle>
            <CardDescription>
              Phishing domains, fake profiles, and brand impersonations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Domain Check Result */}
            {domainCheckResult && (
              <div className={`mb-4 p-4 rounded-lg ${domainCheckResult.is_threat ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                {domainCheckResult.is_threat ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="font-bold text-red-500">Threat Detected!</span>
                      {getRiskBadge((domainCheckResult.threat as any)?.risk_level)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Domain:</span>
                        <span className="ml-2 font-mono">{(domainCheckResult.threat as any)?.target}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2">{(domainCheckResult.threat as any)?.threat_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Similarity:</span>
                        <span className="ml-2">{(((domainCheckResult.threat as any)?.similarity_score || 0) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">No threat detected for this domain</span>
                  </div>
                )}
              </div>
            )}

            {/* Threats Table */}
            {loading.threats ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : threats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No Threats Detected</p>
                <p className="text-sm">Use the scan options on the right to check for threats</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threats.map((threat) => (
                    <TableRow key={threat.id}>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{threat.target}</span>
                          <a href={`https://${threat.target}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary flex-shrink-0" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {threat.threat_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{threat.brand_affected}</TableCell>
                      <TableCell>{getRiskBadge(threat.risk_level)}</TableCell>
                      <TableCell>{getStatusBadge(threat.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedThreat(threat)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => generateReport(threat.id, "abuse")} title="Generate Report">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => createTakedownRequest(threat.id)} title="Request Takedown">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Generated Report */}
            {generatedReport && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Generated Report
                  </h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedReport)}>
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setGeneratedReport("")}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {generatedReport}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configured Brands */}
        {brands.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-green-500" />
                Monitored Brands ({brands.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {brands.map((brand, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{brand.brand_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {brand.typosquat_patterns_count} patterns
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {brand.domains.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel - Scan Options */}
      <div className="w-[380px] border-l bg-slate-900 p-4 overflow-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Search className="h-5 w-5" />
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
          <p className="text-xs text-slate-400">Select a scan type to check for threats</p>
        </div>

        {/* Scan Type Selection */}
        <div className="space-y-2 mb-4">
          {scanOptions.map((option) => (
            <div
              key={option.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                activeScan === option.id 
                  ? 'border-primary bg-primary/20' 
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
              onClick={() => setActiveScan(activeScan === option.id ? null : option.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <option.icon className={`h-5 w-5 ${option.color}`} />
                  <div>
                    <p className="font-medium text-sm text-white">{option.title}</p>
                    <p className="text-xs text-slate-400">{option.description}</p>
                  </div>
                </div>
                {activeScan === option.id ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Scan Input Forms */}
        {activeScan === "domain" && (
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-white">Domain to Check</Label>
                <Input
                  placeholder="suspicious-domain.com"
                  value={domainToCheck}
                  onChange={(e) => setDomainToCheck(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkDomain()}
                  className="mt-1"
                />
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-xs">
                <p className="font-medium text-blue-600 mb-1">Example domains to test:</p>
                <p className="text-muted-foreground">micros0ft.com, paypal-verify.tk, secure-login.xyz</p>
              </div>
              <Button onClick={checkDomain} disabled={loading.domainCheck || !domainToCheck} className="w-full">
                {loading.domainCheck ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                Check Domain
              </Button>
            </CardContent>
          </Card>
        )}

        {activeScan === "bulk" && (
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-white">Domains (one per line)</Label>
                <Textarea
                  placeholder="domain1.com&#10;domain2.net&#10;domain3.xyz"
                  value={bulkDomains}
                  onChange={(e) => setBulkDomains(e.target.value)}
                  rows={5}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <Button onClick={scanBulkDomains} disabled={loading.bulkScan || !bulkDomains} className="w-full">
                {loading.bulkScan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Scan {bulkDomains.split("\n").filter(d => d.trim()).length} Domains
              </Button>
            </CardContent>
          </Card>
        )}

        {activeScan === "social" && (
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-white">Brand Name</Label>
                <Input
                  placeholder="Microsoft"
                  value={socialBrand}
                  onChange={(e) => setSocialBrand(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="p-3 rounded-lg bg-pink-500/10 text-xs">
                <p className="font-medium text-pink-600 mb-1">Note:</p>
                <p className="text-muted-foreground">Brand must be configured first. Checks for fake profiles on Twitter, Instagram, etc.</p>
              </div>
              <Button onClick={checkSocialMedia} disabled={loading.socialCheck || !socialBrand} className="w-full">
                {loading.socialCheck ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                Check Social Media
              </Button>
            </CardContent>
          </Card>
        )}

        {activeScan === "brand" && (
          <Card className="border-slate-700 bg-slate-800">
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label className="text-white">Brand Name *</Label>
                <Input
                  placeholder="MyCompany"
                  value={newBrand.brand_name}
                  onChange={(e) => setNewBrand(prev => ({ ...prev, brand_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Official Domains * (comma-separated)</Label>
                <Input
                  placeholder="mycompany.com, mycompany.io"
                  value={newBrand.domains}
                  onChange={(e) => setNewBrand(prev => ({ ...prev, domains: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Keywords (comma-separated)</Label>
                <Input
                  placeholder="mycompany, myco"
                  value={newBrand.keywords}
                  onChange={(e) => setNewBrand(prev => ({ ...prev, keywords: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Social Handles (platform:handle)</Label>
                <Input
                  placeholder="twitter:mycompany, instagram:myco"
                  value={newBrand.social_handles}
                  onChange={(e) => setNewBrand(prev => ({ ...prev, social_handles: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <Button onClick={addBrand} disabled={loading.addBrand || !newBrand.brand_name || !newBrand.domains} className="w-full">
                {loading.addBrand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Brand
              </Button>
            </CardContent>
          </Card>
        )}

        {!activeScan && (
          <div className="text-center py-8 text-slate-400">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a scan type above to begin</p>
          </div>
        )}
      </div>

      {/* Threat Details Modal */}
      {selectedThreat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedThreat(null)}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto m-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Threat Details
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedThreat(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Target</Label>
                  <p className="font-mono">{selectedThreat.target}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p>{selectedThreat.threat_type.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Brand Affected</Label>
                  <p>{selectedThreat.brand_affected}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Platform</Label>
                  <p>{selectedThreat.platform}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Risk Level</Label>
                  <p>{getRiskBadge(selectedThreat.risk_level)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Similarity Score</Label>
                  <p>{(selectedThreat.similarity_score * 100).toFixed(1)}%</p>
                </div>
              </div>
              
              {selectedThreat.evidence && (
                <div>
                  <Label className="text-muted-foreground">Evidence</Label>
                  <pre className="bg-muted p-4 rounded-lg text-xs mt-2 overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedThreat.evidence, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button onClick={() => generateReport(selectedThreat.id, "abuse")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Abuse Report
                </Button>
                <Button onClick={() => generateReport(selectedThreat.id, "dmca")} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  DMCA Notice
                </Button>
                <Button onClick={() => createTakedownRequest(selectedThreat.id)} variant="destructive">
                  <Send className="h-4 w-4 mr-2" />
                  Request Takedown
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
