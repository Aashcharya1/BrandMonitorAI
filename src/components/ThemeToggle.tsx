"use client"

import * as React from "react"
import { Shield } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const handleToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleToggle}>
            <Shield className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle Theme</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
