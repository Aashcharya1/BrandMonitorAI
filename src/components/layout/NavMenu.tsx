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
  LogIn,
} from "lucide-react";
import { useUser } from "@/firebase";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquare, auth: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: true },
  { href: "/dmarc-monitoring", label: "DMARC", icon: MailCheck, auth: true },
  { href: "/dns-monitoring", label: "DNS", icon: Network, auth: true },
  { href: "/active-passive-monitoring", label: "Monitoring", icon: Activity, auth: true },
  { href: "/dark-web-monitoring", label: "Dark Web", icon: ShieldAlert, auth: true },
  { href: "/social-media-monitoring", label: "Social Media", icon: Users, auth: true },
  { href: "/login", label: "Login", icon: LogIn, auth: false },
];

export function NavMenu() {
  const pathname = usePathname();
  const { user } = useUser();

  const filteredNavItems = navItems.filter(item => item.auth ? !!user : !user);

  return (
    <SidebarMenu className="p-2">
      {filteredNavItems.map((item) => (
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
