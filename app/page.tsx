import { redirect } from 'next/navigation'
import Demonstracao from '@/components/physio/demonstracao'

export default function Inicio() {
  if (process.env.MURARO_MODO_DEMO === 'true') return <Demonstracao/>
  redirect('/sistema')
}
