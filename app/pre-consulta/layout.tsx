import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Pré-consulta | Instituto Muraro', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function Layout({ children }: { children: React.ReactNode }) { return children }
