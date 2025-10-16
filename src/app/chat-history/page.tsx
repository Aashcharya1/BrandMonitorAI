import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ChatHistoryPage() {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat History</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Chat history will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
