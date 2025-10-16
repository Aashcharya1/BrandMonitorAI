import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { DmarcPieChart } from "@/components/charts/DmarcPieChart";
import { mockDmarcData from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow from "@/components/ui/table";
import { Badge from "@/components/ui/badge";

const recentReports = [
    { source: 'google.com', count: 12543, policy: 'none', pass: '99.8%' },
    { source: 'outlook.com', count: 9876, policy: 'none', pass: '99.5%' },
    { source: 'yahoo.com', count: 5432, policy: 'quarantine', pass: '95.1%' },
    { source: 'icloud.com', count: 2109, policy: 'none', pass: '99.9%' },
    { source: 'some-esp.com', count: 876, policy: 'reject', pass: '80.2%' },
    { source: 'mailru.com', count: 451, policy: 'reject', pass: '75.4%' },
];

export default function DmarcMonitoringPage() {
  return (
    <div className="space-y-6">
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
  );
}
