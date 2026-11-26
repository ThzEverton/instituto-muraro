'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core'

type Paciente = { id: string; nomeCompleto: string; ativo: boolean }
type Profissional = { id: string; nome: string; ativo: boolean; corAgenda: string | null }
type Servico = { id: string; nome: string; duracaoMinutos: number; ativo: boolean; profissionais: { profissionalId: string }[] }
type Agendamento = {
  id: string; pacienteId: string; profissionalId: string; servicoId: string;
  inicioEm: string; fimEm: string; situacao: string;
}
type Formulario = { pacienteId: string; profissionalId: string; servicoId: string; inicioEm: string }

async function api<T>(rota: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/sistema/${rota}`, {
    ...opcoes, headers: { 'Content-Type': 'application/json', ...opcoes?.headers }, cache: 'no-store',
  })
  const corpo = await resposta.json()
  if (!resposta.ok) throw new Error(corpo.erro || 'Operação não concluída')
  return corpo
}

function horarioLocal(data: Date) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function Agenda() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [intervalo, setIntervalo] = useState<{ inicio: string; fim: string } | null>(null)
  const [formulario, setFormulario] = useState<Formulario>({ pacienteId: '', profissionalId: '', servicoId: '', inicioEm: '' })
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [filtroProfissional, setFiltroProfissional] = useState('')

  const carregarCadastros = useCallback(async () => {
    const [resultadoPacientes, resultadoProfissionais, resultadoServicos] = await Promise.all([
      api<{ dados: Paciente[] }>('pacientes?ativo=true&limite=100'),
      api<{ dados: Profissional[] }>('profissionais?ativo=true&limite=100'),
      api<{ dados: Servico[] }>('servicos?ativo=true&limite=100'),
    ])
    setPacientes(resultadoPacientes.dados)
    setProfissionais(resultadoProfissionais.dados)
    setServicos(resultadoServicos.dados)
  }, [])
  const carregarAgenda = useCallback(async (periodo: { inicio: string; fim: string }, profissionalId = filtroProfissional) => {
    const parametros = new URLSearchParams({ inicioEm: periodo.inicio, fimEm: periodo.fim })
    if (profissionalId) parametros.set('profissionalId', profissionalId)
    const resultado = await api<{ dados: Agendamento[] }>(`agendamentos?${parametros}`)
    setAgendamentos(resultado.dados)
  }, [filtroProfissional])
  useEffect(() => { carregarCadastros().catch((falha) => setErro(falha.message)) }, [carregarCadastros])
  useEffect(() => { if (intervalo) carregarAgenda(intervalo).catch((falha) => setErro(falha.message)) }, [intervalo, filtroProfissional, carregarAgenda])

  const eventos = useMemo(() => agendamentos.filter((item) => item.situacao !== 'CANCELADO').map((item) => ({
    id: item.id,
    title: `${pacientes.find((paciente) => paciente.id === item.pacienteId)?.nomeCompleto ?? 'Paciente'} · ${servicos.find((servico) => servico.id === item.servicoId)?.nome ?? 'Serviço'}`,
    start: item.inicioEm, end: item.fimEm,
    backgroundColor: profissionais.find((profissional) => profissional.id === item.profissionalId)?.corAgenda ?? '#2b668f',
    extendedProps: { situacao: item.situacao },
  })), [agendamentos, pacientes, profissionais, servicos])

  function datasAlteradas(dados: DatesSetArg) {
    setIntervalo({ inicio: dados.start.toISOString(), fim: dados.end.toISOString() })
  }
  function selecionar(dados: DateSelectArg) {
    setSelecionado(null)
    setFormulario({
      pacienteId: pacientes[0]?.id ?? '', profissionalId: filtroProfissional || (profissionais[0]?.id ?? ''),
      servicoId: '', inicioEm: horarioLocal(dados.start),
    })
    setAberto(true); setErro('')
  }
  function clicarEvento(dados: EventClickArg) {
    const agendamento = agendamentos.find((item) => item.id === dados.event.id)
    if (!agendamento) return
    setSelecionado(agendamento)
    setFormulario({
      pacienteId: agendamento.pacienteId, profissionalId: agendamento.profissionalId,
      servicoId: agendamento.servicoId, inicioEm: horarioLocal(new Date(agendamento.inicioEm)),
    })
    setAberto(true); setErro('')
  }
  async function mover(dados: EventDropArg) {
    const inicio = dados.event.start
    const fim = dados.event.end
    if (!inicio || !fim) { dados.revert(); return }
    try {
      await api(`agendamentos/${dados.event.id}`, {
        method: 'PATCH', body: JSON.stringify({ inicioEm: inicio.toISOString(), fimEm: fim.toISOString() }),
      })
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { dados.revert(); setErro(falha instanceof Error ? falha.message : 'Reagendamento recusado') }
  }
  async function salvar(evento: FormEvent) {
    evento.preventDefault(); setErro(''); setCarregando(true)
    const servico = servicos.find((item) => item.id === formulario.servicoId)
    if (!servico) { setErro('Selecione um serviço'); setCarregando(false); return }
    const inicio = new Date(formulario.inicioEm)
    const fim = new Date(inicio.getTime() + servico.duracaoMinutos * 60_000)
    try {
      await api(selecionado ? `agendamentos/${selecionado.id}` : 'agendamentos', {
        method: selecionado ? 'PATCH' : 'POST',
        body: JSON.stringify({
          pacienteId: formulario.pacienteId, profissionalId: formulario.profissionalId,
          servicoId: formulario.servicoId, inicioEm: inicio.toISOString(), fimEm: fim.toISOString(),
        }),
      })
      setAberto(false)
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao salvar') }
    finally { setCarregando(false) }
  }
  async function mudarSituacao(situacao: string) {
    if (!selecionado) return
    setErro('')
    try {
      await api(`agendamentos/${selecionado.id}`, { method: 'PATCH', body: JSON.stringify({ situacao }) })
      setAberto(false)
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao alterar situação') }
  }
  const servicosDisponiveis = servicos.filter((servico) => servico.profissionais.some((vinculo) => vinculo.profissionalId === formulario.profissionalId))
  return <main className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#3c897d]">Instituto Muraro</p><h1 className="text-3xl font-semibold">Agenda</h1>
      </div><Link href="/sistema" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Voltar aos pacientes</Link></header>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3"><label className="text-sm">Profissional <select className="ml-2 rounded-lg border border-slate-300 px-3 py-2" value={filtroProfissional} onChange={(evento) => setFiltroProfissional(evento.target.value)}><option value="">Todos</option>{profissionais.map((profissional) => <option value={profissional.id} key={profissional.id}>{profissional.nome}</option>)}</select></label></div>
        {erro && <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>}
        <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" locale="pt-br"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          allDaySlot={false} selectable editable events={eventos} datesSet={datasAlteradas}
          select={selecionar} eventClick={clicarEvento} eventDrop={mover} height="auto" />
      </section>
      {aberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={salvar} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">{selecionado ? 'Atendimento' : 'Novo atendimento'}</h2>
        <label className="block text-sm">Paciente<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.pacienteId} onChange={(evento) => setFormulario((atual) => ({ ...atual, pacienteId: evento.target.value }))}><option value="">Selecione</option>{pacientes.map((paciente) => <option value={paciente.id} key={paciente.id}>{paciente.nomeCompleto}</option>)}</select></label>
        <label className="block text-sm">Profissional<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.profissionalId} onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalId: evento.target.value, servicoId: '' }))}><option value="">Selecione</option>{profissionais.map((profissional) => <option value={profissional.id} key={profissional.id}>{profissional.nome}</option>)}</select></label>
        <label className="block text-sm">Serviço<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.servicoId} onChange={(evento) => setFormulario((atual) => ({ ...atual, servicoId: evento.target.value }))}><option value="">Selecione</option>{servicosDisponiveis.map((servico) => <option value={servico.id} key={servico.id}>{servico.nome} · {servico.duracaoMinutos} min</option>)}</select></label>
        <label className="block text-sm">Início<input required type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.inicioEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioEm: evento.target.value }))} /></label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        {selecionado && <div className="flex flex-wrap gap-2 border-t pt-4 text-sm">
          <button type="button" onClick={() => mudarSituacao('CONFIRMADO')} className="rounded-lg border border-slate-300 px-3 py-2">Confirmar</button>
          <button type="button" onClick={() => mudarSituacao('CONCLUIDO')} className="rounded-lg border border-slate-300 px-3 py-2">Concluir</button>
          <button type="button" onClick={() => mudarSituacao('NAO_COMPARECEU')} className="rounded-lg border border-slate-300 px-3 py-2">Falta</button>
          <button type="button" onClick={() => mudarSituacao('CANCELADO')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Cancelar</button>
        </div>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2">Fechar</button><button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white disabled:opacity-50">Salvar</button></div>
      </form></div>}
    </div>
  </main>
}
