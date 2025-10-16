import { Card, CardHeader, CardTitle, CardContent from "@/components/ui/card";
import { DnsBarChart from "@/components/charts/DnsBarChart";
import { mockDnsData from "@/lib/mock-data";

export default function DnsMonitoringPage() {
  return (
    <div className="space-y-6">
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
          <CardTitle>Content Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p>More DNS monitoring widgets are under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}
