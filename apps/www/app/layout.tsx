import './global.css'
import { RootProvider } from 'fumadocs-ui/provider'
import { docsOptions } from '@/app/layout.config'
// import { Inter } from 'next/font/google'
import { monaSans, ppSupplyMono } from '@/utils/fonts'

import type { ReactNode } from 'react'
import { Metadata } from 'next'

// const inter = Inter({
//   subsets: ['latin'],
// })

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // className={inter.className}
      className={`${monaSans.variable} ${ppSupplyMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <RootProvider {...docsOptions}>{children}</RootProvider>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL('https://attest.so/'),
}
