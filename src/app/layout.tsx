// src/app/layout.tsx

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Import the providers we know you have
import { ThemeProvider } from '@/components/ThemeProvider'
import { ClientAuthProvider } from '@/components/ClientAuthProvider'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BrandMonitorAI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClientAuthProvider>
            {children}
          </ClientAuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}