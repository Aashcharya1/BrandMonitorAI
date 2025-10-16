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
} from "@/components/ui/sidebar";
import { NavMenu } from "./NavMenu";
import { Button } from "../ui/button";
import { Settings, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { Separator } from "../ui/separator";
import { Avatar, AvatarFallback } from "../ui/avatar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    if (path === '/') return "Chat";
    return path
      .substring(1)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader>
            <div className="flex items-center gap-2">
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
                <h1 className="text-xl font-semibold group-data-[collapsed=icon]:hidden">BrandMonitorAI</h1>
            </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
            <NavMenu />
        </SidebarContent>
        <SidebarFooter>
            <Separator className="my-2" />
             <div className="flex items-center gap-3 p-2 group-data-[collapsed=icon]:p-0 group-data-[collapsed=icon]:justify-center">
                <Avatar className="h-9 w-9">
                    <AvatarFallback><User size={20} /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col group-data-[collapsed=icon]:hidden">
                    <span className="text-sm font-medium text-foreground">My Profile</span>
                    <span className="text-xs text-muted-foreground">user@example.com</span>
                </div>
            </div>
            <Button variant="ghost" className="w-full justify-start group-data-[collapsed=icon]:justify-center group-data-[collapsed=icon]:w-auto">
              <Settings className="h-5 w-5" />
              <span className="group-data-[collapsed=icon]:hidden">Settings</span>
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6 sticky top-0 z-30">
          <SidebarTrigger />
          <h2 className="text-lg font-medium">{getPageTitle(pathname)}</h2>
        </header>
        <main className="h-full flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
