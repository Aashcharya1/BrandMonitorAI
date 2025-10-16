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
              <svg width="32" height="32" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary">
                <path d="M49 217.156C32.3438 205.812 20.3125 190.453 12.9062 171.078C5.5 151.703 1.79688 130.656 1.79688 107.938C1.79688 85.2188 5.5 64.1719 12.9062 44.7969C20.3125 25.4219 32.3438 10.0625 49 -1.28125L61.7188 13.0625C48.5 22.125 38.8281 34.1562 32.7031 49.1562C26.5781 64.1562 23.5156 80.5781 23.5156 98.4375V117.438C23.5156 128.531 25.3438 139.016 28.9062 148.891C31.5781 156.484 34.8281 163.469 38.6562 169.844L148.156 59.2812C143.219 53.4688 138.984 48.2344 135.453 43.5781C131.922 38.9219 129.547 34.5 128.328 30.3125H102.328V9.3125H158.328V24.0938C158.328 31.8906 160.094 39.5781 163.625 47.1562C167.156 54.7344 171.844 61.7188 177.688 68.1094L212.906 103.328C222.156 94.4219 229.453 84.1406 234.797 72.4844L250.688 84.3125C238.938 101.484 223.578 114.734 204.609 124.078C185.641 133.422 164.5 138.094 141.188 138.094H119.812L207.219 225.5H228.188V246.5H180.188V232.156L112 164.156L71.4688 204.875C78.4531 210.109 85.9375 214.5 93.9219 218.062L84.8438 238.281C73.8438 234.234 64.0938 228.359 55.5938 220.656L49 217.156Z" fill="currentColor"/>
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
        <SidebarFooter className="p-2">
            <SidebarMenu>
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
