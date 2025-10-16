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
  History,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dmarc-monitoring", label: "DMARC", icon: MailCheck },
  { href: "/dns-monitoring", label: "DNS", icon: Network },
  { href: "/active-passive-monitoring", label: "Monitoring", icon: Activity },
  { href: "/dark-web-monitoring", label: "Dark Web", icon: ShieldAlert },
  { href: "/social-media-monitoring", label: "Social Media", icon: Users },
  { href: "/chat-history", label: "Chat History", icon: History },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href}
            tooltip={{ children: item.label, side: "right", align: "center" }}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
