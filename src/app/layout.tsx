// src/app/layout.tsx

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Import the providers we know you have
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/context/AuthContext'

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
    // Wrap the whole app in the AuthProvider
    <AuthProvider>
      <html lang="en">
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            {/* We removed the sidebar for now to fix the error.
              The main content will just be the children.
            */}
            <main className="flex-1">{children}</main>
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  )
}