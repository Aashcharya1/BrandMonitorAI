"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Activity,
  MailCheck,
  Network,
  ShieldAlert,
  Users,
  MessageSquare,
  Globe,
  Database,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/external-surface-monitoring", label: "External Surface", icon: Globe },
  { href: "/data-leak-monitoring", label: "Data Leaks", icon: Database },
  { href: "/takedown-monitoring", label: "Takedown", icon: Shield },
  { href: "/dmarc-monitoring", label: "DMARC", icon: MailCheck },
  { href: "/dns-monitoring", label: "DNS", icon: Network },
  { href: "/active-passive-monitoring", label: "Monitoring", icon: Activity },
  { href: "/dark-web-monitoring", label: "Dark Web", icon: ShieldAlert },
  { href: "/social-media-monitoring", label: "Social Media", icon: Users },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="p-2">
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href}
            tooltip={{ children: item.label, side: "right", align: "center" }}
          >
            <Link href={item.href}>
              <item.icon />
              <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
