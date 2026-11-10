'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ClipboardList, MessageCircle, ShieldCheck } from 'lucide-react'
import './paciente.css'

const questions = [
  { id: 'motivo', label: 'O que trouxe você à fisioterapia?', value: 'Dor no joelho ao subir escadas.' },
  { id: 'dor', label: 'Em uma escala de 0 a 10, qual sua dor hoje?', value: '3' },
  { id: 'rotina', label: 'Como está sua rotina de movimento?', value: 'Consigo caminhar, mas evito longas distâncias.' },
]

export default function PatientView() {
  const [templateName, setTemplateName] = useState('Pré-avaliação fisioterapêutica')
  const [responses, setResponses] = useState<Record<string, string>>(() => Object.fromEntries(questions.map(q => [q.id, q.value])))
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setTemplateName(params.get('template') || 'Pré-avaliação fisioterapêutica')
  }, [])

  const whatsappText = `Simulação Instituto Muraro: acesse o questionário do paciente neste link: ${typeof window !== 'undefined' ? window.location.href : '/paciente?simulacao=1'} Respostas fictícias: ${questions.map(q => `${q.label} ${responses[q.id]}`).join(' | ')}`

  return <main className="patient-page">
    <header className="patient-topbar"><a href="/" className="patient-back"><ArrowLeft size={17}/> Voltar ao painel</a><span className="simulation-pill"><i/> SIMULAÇÃO</span></header>
    <section className="patient-layout">
      <div className="patient-copy"><span className="patient-kicker">VISÃO DO PACIENTE</span><h1>Uma experiência simples para responder pelo celular.</h1><p>Esta página representa o link que o paciente recebe. Todos os dados exibidos são fictícios e servem apenas para a demonstração do Instituto Muraro.</p><div className="patient-note"><ShieldCheck size={18}/><span><strong>Ambiente demonstrativo</strong><small>Nenhuma resposta clínica real é transmitida.</small></span></div></div>
      <div className="patient-phone"><div className="phone-status"><span>09:41</span><span>Instituto Muraro</span></div><div className="phone-screen"><div className="patient-brand"><span className="patient-brand-mark"><ClipboardList size={18}/></span><span><strong>Instituto Muraro</strong><small>Fisioterapia</small></span></div><div className="patient-intro"><span className="mini-label">QUESTIONÁRIO ONLINE</span><h2>{templateName}</h2><p>Olá, Marina. Responda com calma. Leva menos de 2 minutos.</p></div>{questions.map((q, index) => <label className="patient-question" key={q.id}><span>{index + 1}. {q.label}</span>{q.id === 'dor' ? <select value={responses[q.id]} onChange={e => setResponses(v => ({ ...v, [q.id]: e.target.value }))}>{Array.from({ length: 11 }, (_, i) => <option key={i}>{i}</option>)}</select> : <textarea value={responses[q.id]} onChange={e => setResponses(v => ({ ...v, [q.id]: e.target.value }))}/>}</label>)}<button className="patient-submit" onClick={() => setSubmitted(true)}><Check size={17}/> Enviar respostas</button>{submitted && <div className="patient-success" role="status"><Check size={16}/><span><strong>Resposta enviada</strong><small>Simulação concluída e exibida no paciente.</small></span></div>}<button className="patient-whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener,noreferrer')}><MessageCircle size={17}/> Compartilhar simulação no WhatsApp</button></div></div>
    </section>
  </main>
}
