import { notFound } from 'next/navigation'
import Demonstracao from '@/components/physio/demonstracao'
export default function Demo() {
  if (process.env.NODE_ENV === 'production' && process.env.MURARO_MODO_DEMO !== 'true') notFound()
  return <Demonstracao/>
}
