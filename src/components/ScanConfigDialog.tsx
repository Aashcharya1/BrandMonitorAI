"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Activity, 
  Shield, 
  Network,
  Zap,
  Loader2
} from "lucide-react";

interface ScanConfig {
  target: string;
  enablePassive: boolean;
  enableActive: boolean;
  enableVuln: boolean;
  nessusPolicyUuid: string;
}

interface ScanConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartScan: (config: ScanConfig) => void;
  isLoading?: boolean;
}

export function ScanConfigDialog({
  open,
  onOpenChange,
  onStartScan,
  isLoading = false,
}: ScanConfigDialogProps) {
  const [target, setTarget] = useState("");
  const [enablePassive, setEnablePassive] = useState(true);
  const [enableActive, setEnableActive] = useState(true);
  const [enableVuln, setEnableVuln] = useState(false);
  const [nessusPolicyUuid, setNessusPolicyUuid] = useState("");

  const handleSubmit = () => {
    if (!target.trim()) return;
    
    onStartScan({
      target: target.trim(),
      enablePassive,
      enableActive,
      enableVuln,
      nessusPolicyUuid: nessusPolicyUuid.trim() || "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Configure Active & Passive Scan
          </DialogTitle>
          <DialogDescription>
            Configure your security scan parameters. Select the target domain and choose scan types.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target Domain */}
          <div className="space-y-2">
            <Label htmlFor="target" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Target Domain *
            </Label>
            <Input
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="example.com"
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Enter the root domain to scan (e.g., example.com). Do not include http:// or https://
            </p>
          </div>

          <Separator />

          {/* Scan Type Configuration */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Scan Types
            </Label>

            {/* Passive Scan */}
            <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="passive" className="font-medium cursor-pointer">
                    Passive Reconnaissance
                  </Label>
                  <Badge variant="secondary" className="text-xs">amass</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Subdomain enumeration using passive DNS and certificate transparency logs.
                  Fast and non-intrusive.
                </p>
              </div>
              <Switch
                id="passive"
                checked={enablePassive}
                onCheckedChange={setEnablePassive}
                disabled={isLoading}
              />
            </div>

            {/* Active Scan */}
            <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="active" className="font-medium cursor-pointer">
                    Active Scanning
                  </Label>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">masscan</Badge>
                    <Badge variant="secondary" className="text-xs">nmap</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Port discovery with masscan, then service and version detection with nmap.
                  May trigger security alerts.
                </p>
              </div>
              <Switch
                id="active"
                checked={enableActive}
                onCheckedChange={setEnableActive}
                disabled={isLoading}
              />
            </div>

            {/* Vulnerability Scan */}
            <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="vuln" className="font-medium cursor-pointer">
                    Vulnerability Assessment
                  </Label>
                  <Badge variant="destructive" className="text-xs">Nessus</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Deep vulnerability scanning using Nessus. Identifies CVEs, misconfigurations,
                  and security weaknesses. Requires Nessus to be configured.
                </p>
              </div>
              <Switch
                id="vuln"
                checked={enableVuln}
                onCheckedChange={setEnableVuln}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Nessus Policy */}
          {enableVuln && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <Label htmlFor="nessus-policy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Nessus Policy UUID (Optional)
              </Label>
              <Input
                id="nessus-policy"
                value={nessusPolicyUuid}
                onChange={(e) => setNessusPolicyUuid(e.target.value)}
                placeholder="Leave empty to use default policy"
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Specify a custom Nessus scan policy UUID, or leave empty to use the default policy.
              </p>
            </div>
          )}

          {/* Scan Summary */}
          <div className="p-4 border rounded-lg bg-primary/5 space-y-2">
            <p className="text-sm font-medium">Scan Summary</p>
            <div className="flex flex-wrap gap-2">
              {enablePassive && (
                <Badge variant="outline" className="text-xs">
                  Passive (amass)
                </Badge>
              )}
              {enableActive && (
                <Badge variant="outline" className="text-xs">
                  Active (masscan + nmap)
                </Badge>
              )}
              {enableVuln && (
                <Badge variant="outline" className="text-xs">
                  Vulnerabilities (Nessus)
                </Badge>
              )}
              {!enablePassive && !enableActive && !enableVuln && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  No scan types selected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!target.trim() || isLoading || (!enablePassive && !enableActive && !enableVuln)}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Start Scan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

