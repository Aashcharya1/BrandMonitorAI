"use client";

import React from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { NavMenu } from "./NavMenu";
import { Settings, User, MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "../ui/avatar";
import Link from "next/link";
import { ThemeToggle } from "../ThemeToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    if (path === '/') return "Chat";
    if (path.startsWith('/chat/')) return "Chat";
    return path
      .substring(1)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const mockRecentChats = [
    { id: '1', title: 'DMARC Policy Analysis' },
    { id: '2', title: 'Suspicious Domain Query' },
    { id: '3', title: 'Latest Phishing Trends' },
  ];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="p-2">
            <div className="flex items-center gap-2 p-2">
                <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-primary"
                >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <h1 className="text-xl font-semibold group-data-[state=collapsed]:hidden">BrandMonitorAI</h1>
            </div>
        </SidebarHeader>
        <SidebarContent className="p-0">
            <NavMenu />
            <div className="flex-1 overflow-y-auto p-2">
              <p className="px-2 py-2 text-xs font-semibold text-muted-foreground group-data-[state=collapsed]:hidden">Recent</p>
              <SidebarMenu>
                {mockRecentChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/chat/${chat.id}`}
                      tooltip={{ children: chat.title, side: "right", align: "center" }}
                    >
                      <Link href={`/chat/${chat.id}`}>
                        <MessageSquare />
                        <span className="group-data-[state=collapsed]:hidden">{chat.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
        </SidebarContent>
        <SidebarFooter className="p-0">
            <SidebarMenu className="p-2">
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip={{ children: 'My Profile', side: 'right', align: 'center' }} className="h-auto p-2 justify-start group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:justify-center">
                        <Avatar className="h-8 w-8 group-data-[state=collapsed]:h-6 group-data-[state=collapsed]:w-6">
                            <AvatarFallback><User size={18} /></AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col group-data-[state=collapsed]:hidden">
                            <span className="text-sm font-medium text-foreground">My Profile</span>
                            <span className="text-xs text-muted-foreground">user@example.com</span>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip={{ children: 'Settings', side: 'right', align: 'center' }}>
                        <Settings />
                        <span className="group-data-[state=collapsed]:hidden">Settings</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6 sticky top-0 z-30">
          <SidebarTrigger />
          <h2 className="text-lg font-medium">{getPageTitle(pathname)}</h2>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="h-full flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
