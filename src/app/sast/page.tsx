import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const summary = [
  { label: "Critical", color: "bg-red-600", count: 12 },
  { label: "Medium", color: "bg-orange-500", count: 45 },
  { label: "Low", color: "bg-yellow-400", count: 67 },
];

const cards = [
  { title: "List down 10 vulnerabilities", subtitle: "Displays top 10 discovered vulnerabilities.", icon: "🔹" },
  { title: "List down last month vulnerabilities", subtitle: "Shows vulnerabilities from last month’s scan.", icon: "🗓" },
  { title: "List down 10 critical vulnerabilities", subtitle: "Filters and displays top 10 severe issues.", icon: "🚨" },
  { title: "List down 10 medium vulnerabilities", subtitle: "Filters and displays 10 moderate issues.", icon: "📉" },
];

export default function SASTDashboardPage() {
  return (
    <div className="flex h-full">
      {/* Center main content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/20">
        {/* Top header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage your security vulnerabilities
            </p>
          </div>
          <Button className="rounded-full px-6 py-2">Scan Now</Button>
        </header>

        {/* Summary bar */}
        <section className="flex gap-6">
          {summary.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-3 rounded-full ${item.color}`}
              />
              <span className="text-sm font-medium">
                {item.label}: {item.count}
              </span>
            </div>
          ))}
        </section>

        {/* Cards grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg bg-card p-6 shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="text-3xl mb-4">{card.icon}</div>
              <h3 className="text-lg font-semibold mb-1">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.subtitle}</p>
            </div>
          ))}
        </section>

        {/* Search bar */}
        <section className="max-w-xl mx-auto">
          <div className="flex items-center bg-card rounded-full px-4 py-2 shadow">
            <Search className="h-5 w-5 text-muted-foreground mr-2" />
            <input
              placeholder="Search vulnerabilities, projects, or scans…"
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
            />
          </div>
        </section>
      </main>

      {/* Right options panel */}
      <aside className="w-64 shrink-0 border-l bg-gray-900 text-white p-6 space-y-8 hidden lg:block">
        <header>
          <h2 className="text-lg font-semibold">SAST Options</h2>
          <p className="text-xs text-gray-400">
            Configure your scanning options
          </p>
        </header>

        {/* Quick actions */}
        <section>
          <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start bg-gray-800/60 border-gray-700">
              📤 Upload a Code
            </Button>
            <Button variant="outline" className="w-full justify-start bg-gray-800/60 border-gray-700">
              🔗 Integrate Code
            </Button>
          </div>
        </section>

        {/* CI/CD platforms */}
        <section>
          <h3 className="text-sm font-medium mb-2">CI/CD Platforms</h3>
          <div className="space-y-2 text-sm">
            {[
              "CircleCI",
              "Buddy",
              "Codeship",
              "GitHub",
              "Bamboo",
              "GitLab",
              "Azure",
              "AWS",
              "Bitbucket",
              "Travis",
              "Jenkins",
            ].map((platform) => (
              <Button
                key={platform}
                variant="ghost"
                className="w-full justify-start hover:bg-gray-800"
              >
                {platform}
              </Button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
