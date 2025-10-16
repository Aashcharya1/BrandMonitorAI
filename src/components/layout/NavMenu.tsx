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
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
  { href: "/active-passive-monitoring", label: "Active & Passive Monitoring", icon: Activity },
  { href: "/dmarc-monitoring", label: "DMARC Monitoring", icon: MailCheck },
  { href: "/dns-monitoring", label: "DNS Monitoring", icon: Network },
  { href: "/dark-web-monitoring", label: "Dark-Web Monitoring", icon: ShieldAlert },
  { href: "/social-media-monitoring", label: "Social Media Monitoring", icon: Users },
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
