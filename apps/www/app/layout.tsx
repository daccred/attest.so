import './global.css'
import { RootProvider } from 'fumadocs-ui/provider'
import { docsOptions } from '@/app/layout.config'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import { Metadata } from 'next'

const inter = Inter({
  subsets: ['latin'],
})

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider {...docsOptions}>{children}</RootProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL('https://explhttps://explorer.attest.so/')
}
