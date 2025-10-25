"use client";

import React, { useEffect } from "react";
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
import { Settings, User, MessageSquare, LogOut, Shield } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "../ui/avatar";
import Link from "next/link";
import { ThemeToggle } from "../ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { Button } from "../ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();


  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login" && pathname !== "/register") {
      router.push("/login");
    }
  }, [isLoading, user, pathname, router]);


  const getPageTitle = (path: string) => {
    if (path === '/') return "Chat";
    if (path.startsWith('/chat/')) return "Chat";
    if (path === '/login') return "Login";
    return path
      .substring(1)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const handleLogout = () => {
    logout();
  };

  const mockRecentChats = [
    { id: '1', title: 'DMARC Policy Analysis' },
    { id: '2', title: 'Suspicious Domain Query' },
    { id: '3', title: 'Latest Phishing Trends' },
  ];
  
  if (pathname === '/login' || pathname === '/register') {
    return <main className="h-full flex-1 overflow-auto">{children}</main>;
  }

  if (isLoading || (!user && pathname !== '/login')) {
    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="p-2">
            <div className="flex items-center gap-2 p-2">
              <Shield className="h-8 w-8 text-primary" />
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
                    <SidebarMenuButton tooltip={{ children: 'My Profile', side: 'right', align: 'center' }} className="h-auto p-2 justify-start group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:justify-center">
                        <Avatar className="h-8 w-8 group-data-[state=collapsed]:h-8 group-data-[state=collapsed]:w-8">
                            <AvatarFallback><User size={18} /></AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col group-data-[state=collapsed]:hidden">
                            <span className="text-sm font-medium text-foreground truncate">{user?.email ?? 'My Profile'}</span>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} tooltip={{ children: 'Logout', side: 'right', align: 'center' }}>
                        <LogOut />
                        <span className="group-data-[state=collapsed]:hidden">Logout</span>
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
