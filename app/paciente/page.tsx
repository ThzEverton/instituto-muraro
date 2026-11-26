import { notFound } from 'next/navigation'
import PacienteDemo from '@/components/physio/paciente-demo'
export default function Paciente() {
  if (process.env.NODE_ENV === 'production' && process.env.MURARO_MODO_DEMO !== 'true') notFound()
  return <PacienteDemo/>
}
