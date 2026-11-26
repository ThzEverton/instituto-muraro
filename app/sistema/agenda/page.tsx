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
  inicioEm: string; fimEm: string; situacao: string; salaId?: string | null; serieId?: string | null;
}
type Ausencia = { id: string; profissionalId: string | null; dataInicio: string; dataFim: string; motivo: string }
type Bloqueio = { id: string; profissionalId: string; inicioEm: string; fimEm: string; tipo: string }
type Sala = { id: string; nome: string; capacidade: number; ativo: boolean }
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
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaId, setSalaId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [intervaloSemanas, setIntervaloSemanas] = useState(1)
  const [salaAberta, setSalaAberta] = useState(false)
  const [nomeSala, setNomeSala] = useState('')
  const [capacidadeSala, setCapacidadeSala] = useState(1)
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [ausenciaAberta, setAusenciaAberta] = useState(false)
  const [formAusencia, setFormAusencia] = useState({ profissionalId: '', dataInicio: '', dataFim: '', motivo: '' })
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [bloqueioAberto, setBloqueioAberto] = useState(false)
  const [formBloqueio, setFormBloqueio] = useState({ profissionalId: '', inicioEm: '', fimEm: '', tipo: '' })
  const [disponibilidade, setDisponibilidade] = useState<{ disponivel: boolean; vagasRestantes: number } | null>(null)
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
    setSalas((await api<{ dados: Sala[] }>('salas')).dados)
    setPacientes(resultadoPacientes.dados)
    setProfissionais(resultadoProfissionais.dados)
    setServicos(resultadoServicos.dados)
  }, [])
  const carregarAgenda = useCallback(async (periodo: { inicio: string; fim: string }, profissionalId = filtroProfissional) => {
    const parametros = new URLSearchParams({ inicioEm: periodo.inicio, fimEm: periodo.fim })
    if (profissionalId) parametros.set('profissionalId', profissionalId)
    const resultado = await api<{ dados: Agendamento[] }>(`agendamentos?${parametros}`)
    const resultadoBloqueios = await api<{ dados: Bloqueio[] }>('agenda/bloqueios?' + parametros)
    setAgendamentos(resultado.dados)
    setBloqueios(resultadoBloqueios.dados)
    setAusencias((await api<{ dados: Ausencia[] }>('agenda/ausencias?' + parametros)).dados)
  }, [filtroProfissional])
  useEffect(() => { carregarCadastros().catch((falha) => setErro(falha.message)) }, [carregarCadastros])
  useEffect(() => { if (intervalo) carregarAgenda(intervalo).catch((falha) => setErro(falha.message)) }, [intervalo, filtroProfissional, carregarAgenda])

  const eventos = useMemo(() => [...agendamentos.filter((item) => item.situacao !== 'CANCELADO').map((item) => ({
    id: item.id,
    title: `${pacientes.find((paciente) => paciente.id === item.pacienteId)?.nomeCompleto ?? 'Paciente'} · ${servicos.find((servico) => servico.id === item.servicoId)?.nome ?? 'Serviço'}`,
    start: item.inicioEm, end: item.fimEm,
    backgroundColor: profissionais.find((profissional) => profissional.id === item.profissionalId)?.corAgenda ?? '#2b668f',
    extendedProps: { situacao: item.situacao },
  })), ...bloqueios.map((item) => ({
    id: 'bloqueio:' + item.id, title: 'Bloqueado: ' + item.tipo,
    start: item.inicioEm, end: item.fimEm, backgroundColor: '#64748b',
    editable: false, extendedProps: { situacao: 'BLOQUEADO' },
  })), ...ausencias.map(item => ({
    id: 'ausencia:' + item.id,
    title: item.motivo + (item.profissionalId ? ' - ' + (profissionais.find(p => p.id === item.profissionalId)?.nome ?? 'Profissional') : ' - Clinica fechada'),
    start: item.dataInicio, end: new Date(Date.parse(item.dataFim) + 86400000).toISOString().slice(0,10),
    allDay: true, editable: false, backgroundColor: '#9f1239',
  }))], [agendamentos, bloqueios, ausencias, pacientes, profissionais, servicos])

  function datasAlteradas(dados: DatesSetArg) {
    setIntervalo({ inicio: dados.start.toISOString(), fim: dados.end.toISOString() })
  }
  function selecionar(dados: DateSelectArg) {
    setSalaId(''); setQuantidade(1); setIntervaloSemanas(1)
    setDisponibilidade(null)
    setSelecionado(null)
    setFormulario({
      pacienteId: pacientes[0]?.id ?? '', profissionalId: filtroProfissional || (profissionais[0]?.id ?? ''),
      servicoId: '', inicioEm: horarioLocal(dados.start),
    })
    setAberto(true); setErro('')
  }
  function clicarEvento(dados: EventClickArg) {
    if (dados.event.id.startsWith('ausencia:')) {
      const item = ausencias.find(a => a.id === dados.event.id.slice(9))
      if (item && window.confirm('Remover: ' + item.motivo + '?')) void removerAusencia(item.id)
      return
    }
    if (dados.event.id.startsWith('bloqueio:')) {
      const item = bloqueios.find((b) => b.id === dados.event.id.slice(8))
      if (item && window.confirm('Remover bloqueio: ' + item.tipo + '?')) void desbloquear(item.id)
      return
    }
    const agendamento = agendamentos.find((item) => item.id === dados.event.id)
    if (!agendamento) return
    setSalaId(agendamento.salaId ?? ''); setQuantidade(1); setIntervaloSemanas(1)
    setSelecionado(agendamento)
    setFormulario({
      pacienteId: agendamento.pacienteId, profissionalId: agendamento.profissionalId,
      servicoId: agendamento.servicoId, inicioEm: horarioLocal(new Date(agendamento.inicioEm)),
    })
    setAberto(true); setErro('')
  }
  async function salvarSala(evento: FormEvent) {
    evento.preventDefault(); setCarregando(true); setErro('')
    try {
      await api('salas', { method: 'POST', body: JSON.stringify({ nome: nomeSala, capacidade: capacidadeSala }) })
      setSalas((await api<{ dados: Sala[] }>('salas')).dados)
      setSalaAberta(false)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao cadastrar sala') }
    finally { setCarregando(false) }
  }
  async function removerAusencia(id: string) {
    setErro('')
    try {
      await api('agenda/ausencias/' + id, { method: 'PATCH' })
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao reabrir periodo') }
  }
  async function salvarAusencia(evento: FormEvent) {
    evento.preventDefault(); setErro(''); setCarregando(true)
    try {
      await api('agenda/ausencias', { method: 'POST', body: JSON.stringify({ ...formAusencia, profissionalId: formAusencia.profissionalId || null }) })
      setAusenciaAberta(false)
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao salvar periodo') }
    finally { setCarregando(false) }
  }
  async function desbloquear(id: string) {
    setErro('')
    try {
      await api('agenda/bloqueios/' + id, { method: 'PATCH' })
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao desbloquear') }
  }
  async function salvarBloqueio(evento: FormEvent) {
    evento.preventDefault(); setErro(''); setCarregando(true)
    try {
      await api('agenda/bloqueios', { method: 'POST', body: JSON.stringify({
        ...formBloqueio, inicioEm: new Date(formBloqueio.inicioEm).toISOString(),
        fimEm: new Date(formBloqueio.fimEm).toISOString(),
      }) })
      setBloqueioAberto(false)
      if (intervalo) await carregarAgenda(intervalo)
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao bloquear') }
    finally { setCarregando(false) }
  }
  useEffect(() => {
    setDisponibilidade(null)
    if (!aberto || selecionado || !formulario.profissionalId || !formulario.servicoId || !formulario.inicioEm) return
    let vigente = true
    const inicio = new Date(formulario.inicioEm)
    if (Number.isNaN(inicio.getTime())) return
    const parametros = new URLSearchParams({ profissionalId: formulario.profissionalId, servicoId: formulario.servicoId, inicioEm: inicio.toISOString() })
    if (salaId) parametros.set('salaId', salaId)
    api<{ dados: { disponivel: boolean; vagasRestantes: number } }>('agenda/disponibilidade?' + parametros)
      .then((r) => { if (vigente) setDisponibilidade(r.dados) })
      .catch(() => { if (vigente) setDisponibilidade(null) })
    return () => { vigente = false }
  }, [aberto, selecionado, formulario.profissionalId, formulario.servicoId, formulario.inicioEm, salaId])
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
      await api(selecionado ? `agendamentos/${selecionado.id}` : quantidade > 1 ? 'agendamentos/serie' : 'agendamentos', {
        method: selecionado ? 'PATCH' : 'POST',
        body: JSON.stringify({
          pacienteId: formulario.pacienteId, profissionalId: formulario.profissionalId,
          servicoId: formulario.servicoId, inicioEm: inicio.toISOString(), fimEm: fim.toISOString(), salaId: salaId || null,
          ...(!selecionado && quantidade > 1 ? { quantidade, intervaloSemanas } : {}),
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
        <button type="button" className="mb-4 rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => {
          setErro(''); setFormBloqueio({ profissionalId: filtroProfissional || profissionais[0]?.id || '', inicioEm: '', fimEm: '', tipo: '' }); setBloqueioAberto(true)
        }}>Bloquear horário</button>
        <button type="button" className="mb-4 ml-2 rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setNomeSala(''); setCapacidadeSala(1); setErro(''); setSalaAberta(true) }}>Cadastrar sala</button>
        <button type="button" className="mb-4 ml-2 rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => { setErro(''); setFormAusencia({ profissionalId: filtroProfissional, dataInicio: '', dataFim: '', motivo: '' }); setAusenciaAberta(true) }}>Feriados e férias</button>
        <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" locale="pt-br"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          allDaySlot={true} selectable editable events={eventos} datesSet={datasAlteradas}
          select={selecionar} eventClick={clicarEvento} eventDrop={mover} height="auto" />
      </section>
      {ausenciaAberta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <form onSubmit={salvarAusencia} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold">Feriados e férias</h2>
          <label className="block text-sm">Aplicar a<select className="mt-1 w-full rounded-lg border p-2" value={formAusencia.profissionalId} onChange={e => setFormAusencia(a => ({ ...a, profissionalId: e.target.value }))}><option value="">Toda a clínica</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <label className="block text-sm">Primeiro dia<input required type="date" className="mt-1 w-full rounded-lg border p-2" value={formAusencia.dataInicio} onChange={e => setFormAusencia(a => ({ ...a, dataInicio: e.target.value }))} /></label>
          <label className="block text-sm">Último dia (inclusive)<input required type="date" min={formAusencia.dataInicio} className="mt-1 w-full rounded-lg border p-2" value={formAusencia.dataFim} onChange={e => setFormAusencia(a => ({ ...a, dataFim: e.target.value }))} /></label>
          <label className="block text-sm">Motivo<input required minLength={2} maxLength={100} className="mt-1 w-full rounded-lg border p-2" value={formAusencia.motivo} onChange={e => setFormAusencia(a => ({ ...a, motivo: e.target.value }))} /></label>
          <p className="text-xs text-slate-600">Atendimentos existentes precisam ser reagendados antes de bloquear o período.</p>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setAusenciaAberta(false)} className="rounded-lg border px-4 py-2">Fechar</button><button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white">Salvar</button></div>
        </form>
      </div>}
      {salaAberta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <form onSubmit={salvarSala} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold">Cadastrar sala</h2>
          <label className="block text-sm">Nome<input required minLength={2} maxLength={100} className="mt-1 w-full rounded-lg border p-2" value={nomeSala} onChange={e => setNomeSala(e.target.value)} /></label>
          <label className="block text-sm">Capacidade<input required type="number" min={1} max={100} className="mt-1 w-full rounded-lg border p-2" value={capacidadeSala} onChange={e => setCapacidadeSala(Number(e.target.value))} /></label>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setSalaAberta(false)} className="rounded-lg border px-4 py-2">Fechar</button><button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white">Salvar</button></div>
        </form>
      </div>}
      {bloqueioAberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <form onSubmit={salvarBloqueio} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold">Bloquear horário</h2>
          <label className="block text-sm">Profissional<select required className="mt-1 w-full rounded-lg border p-2" value={formBloqueio.profissionalId} onChange={(e) => setFormBloqueio(a => ({ ...a, profissionalId: e.target.value }))}><option value="">Selecione</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <label className="block text-sm">Início<input required type="datetime-local" className="mt-1 w-full rounded-lg border p-2" value={formBloqueio.inicioEm} onChange={e => setFormBloqueio(a => ({ ...a, inicioEm: e.target.value }))} /></label>
          <label className="block text-sm">Fim<input required type="datetime-local" className="mt-1 w-full rounded-lg border p-2" value={formBloqueio.fimEm} onChange={e => setFormBloqueio(a => ({ ...a, fimEm: e.target.value }))} /></label>
          <label className="block text-sm">Motivo<input required minLength={2} maxLength={100} className="mt-1 w-full rounded-lg border p-2" value={formBloqueio.tipo} onChange={e => setFormBloqueio(a => ({ ...a, tipo: e.target.value }))} /></label>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setBloqueioAberto(false)} className="rounded-lg border px-4 py-2">Fechar</button><button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white disabled:opacity-50">Bloquear</button></div>
        </form>
      </div>}
      {aberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={salvar} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">{selecionado ? 'Atendimento' : 'Novo atendimento'}</h2>
        <label className="block text-sm">Paciente<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.pacienteId} onChange={(evento) => setFormulario((atual) => ({ ...atual, pacienteId: evento.target.value }))}><option value="">Selecione</option>{pacientes.map((paciente) => <option value={paciente.id} key={paciente.id}>{paciente.nomeCompleto}</option>)}</select></label>
        <label className="block text-sm">Profissional<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.profissionalId} onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalId: evento.target.value, servicoId: '' }))}><option value="">Selecione</option>{profissionais.map((profissional) => <option value={profissional.id} key={profissional.id}>{profissional.nome}</option>)}</select></label>
        <label className="block text-sm">Serviço<select required className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.servicoId} onChange={(evento) => setFormulario((atual) => ({ ...atual, servicoId: evento.target.value }))}><option value="">Selecione</option>{servicosDisponiveis.map((servico) => <option value={servico.id} key={servico.id}>{servico.nome} · {servico.duracaoMinutos} min</option>)}</select></label>
        <label className="block text-sm">Início<input required type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={formulario.inicioEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioEm: evento.target.value }))} /></label>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <label className="block text-sm">Sala<select className="mt-1 w-full rounded-lg border p-2" value={salaId} onChange={e => setSalaId(e.target.value)}><option value="">Sem sala definida</option>{salas.filter(s => s.ativo || s.id === salaId).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.capacidade} vagas)</option>)}</select></label>
        {!selecionado && <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Quantidade de sessões<input type="number" min={1} max={52} required className="mt-1 w-full rounded-lg border p-2" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} /></label>
          {quantidade > 1 && <label className="block text-sm">Intervalo<select className="mt-1 w-full rounded-lg border p-2" value={intervaloSemanas} onChange={e => setIntervaloSemanas(Number(e.target.value))}>{[1,2,3,4].map(n => <option key={n} value={n}>A cada {n} semana(s)</option>)}</select></label>}
        </div>}
        {quantidade > 1 && !selecionado && <p className="text-xs text-slate-600">Todas as sessões precisam estar livres. Se houver conflito, nenhuma será criada.</p>}
        {!selecionado && disponibilidade && <p role="status" className={disponibilidade.disponivel ? 'text-sm text-green-700' : 'text-sm text-red-700'}>{disponibilidade.disponivel ? disponibilidade.vagasRestantes + ' vaga(s) disponível(is)' : 'Horário indisponível'}</p>}
        {selecionado && <div className="flex flex-wrap gap-2 border-t pt-4 text-sm">
            <Link href={'/sistema/financeiro?agendamento=' + encodeURIComponent(selecionado.id) + '&paciente=' + encodeURIComponent(selecionado.pacienteId)} className="rounded-lg border border-slate-300 px-3 py-2">Plano e sessão</Link>
            <Link href={'/sistema/formularios?agendamento=' + encodeURIComponent(selecionado.id)} className="rounded-lg border border-slate-300 px-3 py-2">Pré-consulta</Link>
          <button type="button" onClick={() => mudarSituacao('CONFIRMADO')} className="rounded-lg border border-slate-300 px-3 py-2">Confirmar</button>
          <button type="button" onClick={() => mudarSituacao('CONCLUIDO')} className="rounded-lg border border-slate-300 px-3 py-2">Concluir</button>
          <button type="button" onClick={() => mudarSituacao('NAO_COMPARECEU')} className="rounded-lg border border-slate-300 px-3 py-2">Falta</button>
          <button type="button" onClick={() => mudarSituacao('CANCELADO')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Cancelar</button>
        </div>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2">Fechar</button><button disabled={carregando || (!selecionado && disponibilidade?.disponivel === false)} className="rounded-lg bg-[#142b49] px-4 py-2 text-white disabled:opacity-50">Salvar</button></div>
      </form></div>}
    </div>
  </main>
}
