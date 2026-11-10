import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Instituto Muraro | Gestão em Fisioterapia',
  description: 'Demonstração de gestão em fisioterapia do Instituto Muraro: pacientes, agenda, avaliações, planos terapêuticos e financeiro.',
  generator: 'Instituto Muraro',
  icons: {
    icon: [
      {
        url: '/instituto-muraro-logo.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/instituto-muraro-logo.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/instituto-muraro-logo.png',
        type: 'image/png',
      },
    ],
    apple: '/instituto-muraro-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#142b49' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
