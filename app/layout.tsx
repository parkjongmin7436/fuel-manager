import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '⛽ 주유 관리',
  description: '빠르고 간편한 주유 기록 및 연비 관리',
  manifest: '/manifest.json',
  themeColor: '#4e7cff',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '주유 관리'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
