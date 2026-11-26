'use client'
import {usePerfilSessao} from '@/lib/sessao-interface'

import { useCallback, useEffect, useMemo, useState, useRef, type FormEvent } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardList, Plus, LockKeyhole, X, Edit3, Check } from 'lucide-react'
import { SectionHeader, Table, Badge, stateTone, Empty, PillButton, ErrorNote, Dialog } from '@/components/physio/ui'
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
  const calendario=useRef<FullCalendar>(null)
  const [compacto,setCompacto]=useState(false)
  useEffect(()=>{
   const media=window.matchMedia('(max-width: 790px)')
   const atualizar=()=>{setCompacto(media.matches);if(media.matches&&calendario.current?.getApi().view.type==='timeGridWeek')calendario.current.getApi().changeView('timeGridDay')}
   atualizar();media.addEventListener('change',atualizar);return()=>media.removeEventListener('change',atualizar)
  },[])
  const perfil=usePerfilSessao()
  useEffect(()=>{const timer=setTimeout(()=>calendario.current?.getApi().updateSize(),250);return()=>clearTimeout(timer)},[compacto])
  const [visualizacao,setVisualizacao]=useState<'calendar'|'list'>('calendar')
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
      api<{ dados: Paciente[] }>('pacientes?limite=100'),
      api<{ dados: Profissional[] }>('profissionais?limite=100'),
      api<{ dados: Servico[] }>('servicos?limite=100'),
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
  useEffect(() => {

    carregarCadastros().catch(falha=>setErro(falha.message))
    const q=new URLSearchParams(window.location.search)
    if(q.get('novo')==='1'){
      setFormulario({pacienteId:q.get('paciente')||'',profissionalId:'',servicoId:'',inicioEm:horarioLocal(new Date())})
      setAberto(true)
    }
  }, [carregarCadastros])
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
    setIntervalo(atual=>{const inicio=dados.start.toISOString(),fim=dados.end.toISOString();return atual?.inicio===inicio&&atual.fim===fim?atual:{inicio,fim}})
  }
  function selecionar(dados: DateSelectArg) {
    setSalaId(''); setQuantidade(1); setIntervaloSemanas(1)
    setDisponibilidade(null)
    setSelecionado(null)
    setFormulario({
      pacienteId: '', profissionalId: filtroProfissional || '',
      servicoId: '', inicioEm: horarioLocal(dados.start),
    })
    setAberto(true); setErro('')
  }
  function clicarEvento(dados: EventClickArg) {
    if (dados.event.id.startsWith('ausencia:')) {
      const item = ausencias.find(a => a.id === dados.event.id.slice(9))
      if (perfil==='ADMINISTRADOR' && item && window.confirm('Remover: ' + item.motivo + '?')) void removerAusencia(item.id)
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
  const servicosDisponiveis = servicos.filter((servico) => (servico.ativo&&servico.profissionais.some((vinculo) => vinculo.profissionalId === formulario.profissionalId))||servico.id===selecionado?.servicoId)
  const status:Record<string,string>={AGENDADO:'Agendado',AGUARDANDO_CONFIRMACAO:'Aguardando confirmação',CONFIRMADO:'Confirmado',EM_ATENDIMENTO:'Em atendimento',CONCLUIDO:'Concluído',NAO_COMPARECEU:'Não compareceu',CANCELADO:'Cancelado'}
  const abrirNovo=()=>{
    setSelecionado(null);setSalaId('');setQuantidade(1);setIntervaloSemanas(1);setDisponibilidade(null)
    setFormulario({pacienteId:'',profissionalId:filtroProfissional||'',servicoId:'',inicioEm:horarioLocal(new Date())})
    setErro('');setAberto(true)
  }
  const abrirAtendimento=(a:Agendamento)=>{
    setSelecionado(a);setSalaId(a.salaId??'');setQuantidade(1);setIntervaloSemanas(1);setFormulario({pacienteId:a.pacienteId,profissionalId:a.profissionalId,servicoId:a.servicoId,inicioEm:horarioLocal(new Date(a.inicioEm))});setErro('');setAberto(true)
  }
  return <>
    <SectionHeader eyebrow="GESTÃO DE HORÁRIOS" title="Agenda de atendimentos" description="Visualize sessões, bloqueios, horários e disponibilidade da equipe." actions={<><button className="m-btn secondary" onClick={()=>{setErro('');setFormBloqueio({profissionalId:filtroProfissional||profissionais.find(p=>p.ativo)?.id||'',inicioEm:'',fimEm:'',tipo:''});setBloqueioAberto(true)}}><LockKeyhole size={16}/> Bloquear horário</button><button className="m-btn primary" onClick={abrirNovo}><Plus size={17}/> Novo agendamento</button></>}/>
    <section className="m-card m-agenda-card">
      <div className="m-agenda-toolbar"><div className="m-agenda-filters"><label>Fisioterapeuta <select value={filtroProfissional} onChange={e=>setFiltroProfissional(e.target.value)}><option value="">Todos os profissionais</option>{profissionais.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label></div><div className="m-view-switch"><button className={visualizacao==='calendar'?'active':''} onClick={()=>setVisualizacao('calendar')}><CalendarDays size={16}/> Calendário</button><button className={visualizacao==='list'?'active':''} onClick={()=>setVisualizacao('list')}><ClipboardList size={16}/> Lista</button></div></div>
      <div className="m-agenda-legend"><span className="m-legend-title">Cores da agenda</span>{profissionais.filter(p=>p.ativo&&(filtroProfissional?p.id===filtroProfissional:agendamentos.some(a=>a.profissionalId===p.id))).slice(0,8).map(p=><span key={p.id}><i style={{background:p.corAgenda??'#2b668f'}}/>{p.nome}</span>)}<span><i style={{background:'#64748b'}}/>Bloqueios</span><span><i style={{background:'#9f1239'}}/>Ausências</span></div>
      {erro&&!aberto&&!bloqueioAberto&&!salaAberta&&!ausenciaAberta&&<ErrorNote message={erro}/>}
      <div className="m-cal-wrap" style={visualizacao==='list'?{display:'none'}:undefined}><FullCalendar ref={calendario} plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]} initialView="timeGridWeek" locale="pt-br" allDayText="Dia inteiro" headerToolbar={{left:'prev,next today',center:'title',right:compacto?'dayGridMonth,timeGridDay':'dayGridMonth,timeGridWeek,timeGridDay'}} buttonText={{today:'Hoje',month:'Mês',week:'Semana',day:'Dia'}} allDaySlot={true} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:30:00" nowIndicator selectable editable={!compacto} selectMirror events={eventos} datesSet={datasAlteradas} select={selecionar} eventClick={clicarEvento} eventDrop={mover} height={compacto?650:760} scrollTime="08:00:00" dayMaxEvents={3}/></div>
      {visualizacao==='list'&&<Table<Agendamento> rows={agendamentos.filter(a=>a.situacao!=='CANCELADO')} columns={[
        {label:'Data / hora',cell:a=>new Date(a.inicioEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})},
        {label:'Paciente',cell:a=>pacientes.find(p=>p.id===a.pacienteId)?.nomeCompleto??'Paciente'},
        {label:'Fisioterapeuta',cell:a=>profissionais.find(p=>p.id===a.profissionalId)?.nome??'Profissional'},
        {label:'Serviço',cell:a=>servicos.find(p=>p.id===a.servicoId)?.nome??'Serviço'},
        {label:'Situação',cell:a=><Badge tone={stateTone(status[a.situacao]??a.situacao)}>{status[a.situacao]??a.situacao}</Badge>}
      ]} actions={a=><PillButton title="Ver atendimento" onClick={()=>abrirAtendimento(a)}><Edit3 size={16}/></PillButton>}/>}
    </section>
    <section className="m-card m-blocks-card"><div className="m-card-head"><div><h2>Bloqueios e indisponibilidades</h2><p>Intervalos, feriados, férias e salas da equipe</p></div>{perfil==='ADMINISTRADOR'&&<div className="m-inline-actions"><button className="m-btn secondary" onClick={()=>{setNomeSala('');setCapacidadeSala(1);setErro('');setSalaAberta(true)}}>Cadastrar sala</button><button className="m-btn secondary" onClick={()=>{setErro('');setFormAusencia({profissionalId:filtroProfissional,dataInicio:'',dataFim:'',motivo:''});setAusenciaAberta(true)}}>Feriados e férias</button></div>}</div>
      {bloqueios.length===0&&ausencias.length===0?<Empty title="Sem bloqueios no período" description="Adicione intervalos e ausências para proteger a agenda."/>:<div className="m-block-list">{bloqueios.map(b=><div key={b.id}><span className="m-block-symbol"><LockKeyhole size={17}/></span><div><strong>{b.tipo}</strong><small>{profissionais.find(p=>p.id===b.profissionalId)?.nome} • {new Date(b.inicioEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</small></div><PillButton title="Remover bloqueio" variant="danger" onClick={()=>{if(window.confirm('Remover bloqueio?'))void desbloquear(b.id)}}><X size={16}/></PillButton></div>)}{ausencias.map(a=><div key={a.id}><span className="m-block-symbol"><LockKeyhole size={17}/></span><div><strong>{a.motivo}</strong><small>{a.dataInicio} a {a.dataFim} • {a.profissionalId?profissionais.find(p=>p.id===a.profissionalId)?.nome:'Toda a clínica'}</small></div>{perfil==='ADMINISTRADOR'&&<PillButton title="Remover ausência" variant="danger" onClick={()=>{if(window.confirm('Remover ausência?'))void removerAusencia(a.id)}}><X size={16}/></PillButton>}</div>)}</div>}
    </section>
      {ausenciaAberta&&<Dialog title={'Feriados e férias'} subtitle="Defina os dados para organizar a disponibilidade da equipe." wide onClose={()=>{if(!carregando)setAusenciaAberta(false)}} footer={<><button className="m-btn secondary" disabled={carregando} onClick={()=>setAusenciaAberta(false)}>Fechar</button><button form="agenda-ausenciaAberta" type="submit" className="m-btn primary" disabled={carregando}>{carregando?'Salvando...':'Salvar ausência'}</button></>}><form id="agenda-ausenciaAberta" onSubmit={salvarAusencia} className="m-form-grid"><label className="m-field"><span className="m-field-label">Aplicar a</span><select className="m-input" value={formAusencia.profissionalId} onChange={e => setFormAusencia(a => ({ ...a, profissionalId: e.target.value }))}><option value="">Toda a clínica</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <label className="m-field"><span className="m-field-label">Primeiro dia</span><input required type="date" className="m-input" value={formAusencia.dataInicio} onChange={e => setFormAusencia(a => ({ ...a, dataInicio: e.target.value }))} /></label>
          <label className="m-field"><span className="m-field-label">Último dia (inclusive)</span><input required type="date" min={formAusencia.dataInicio} className="m-input" value={formAusencia.dataFim} onChange={e => setFormAusencia(a => ({ ...a, dataFim: e.target.value }))} /></label>
          <label className="m-field"><span className="m-field-label">Motivo</span><input required minLength={2} maxLength={100} className="m-input" value={formAusencia.motivo} onChange={e => setFormAusencia(a => ({ ...a, motivo: e.target.value }))} /></label>
          <p className="col-span-full text-sm text-slate-600">Atendimentos existentes precisam ser reagendados antes de bloquear o período.</p>
          {erro && <p role="alert" className="col-span-full text-sm text-red-700">{erro}</p>}</form></Dialog>}
      {salaAberta&&<Dialog title={'Cadastrar sala'} subtitle="Defina os dados para organizar a disponibilidade da equipe." onClose={()=>{if(!carregando)setSalaAberta(false)}} footer={<><button className="m-btn secondary" disabled={carregando} onClick={()=>setSalaAberta(false)}>Fechar</button><button form="agenda-salaAberta" type="submit" className="m-btn primary" disabled={carregando}>{carregando?'Salvando...':'Salvar sala'}</button></>}><form id="agenda-salaAberta" onSubmit={salvarSala} className="m-form-grid"><label className="m-field"><span className="m-field-label">Nome</span><input required minLength={2} maxLength={100} className="m-input" value={nomeSala} onChange={e => setNomeSala(e.target.value)} /></label>
          <label className="m-field"><span className="m-field-label">Capacidade</span><input required type="number" min={1} max={100} className="m-input" value={capacidadeSala} onChange={e => setCapacidadeSala(Number(e.target.value))} /></label>
          {erro && <p role="alert" className="col-span-full text-sm text-red-700">{erro}</p>}</form></Dialog>}
      {bloqueioAberto&&<Dialog title={'Bloquear horário'} subtitle="Defina os dados para organizar a disponibilidade da equipe." wide onClose={()=>{if(!carregando)setBloqueioAberto(false)}} footer={<><button className="m-btn secondary" disabled={carregando} onClick={()=>setBloqueioAberto(false)}>Fechar</button><button form="agenda-bloqueioAberto" type="submit" className="m-btn primary" disabled={carregando}>{carregando?'Salvando...':'Bloquear horário'}</button></>}><form id="agenda-bloqueioAberto" onSubmit={salvarBloqueio} className="m-form-grid"><label className="m-field"><span className="m-field-label">Profissional</span><select required className="m-input" value={formBloqueio.profissionalId} onChange={(e) => setFormBloqueio(a => ({ ...a, profissionalId: e.target.value }))}><option value="">Selecione</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          <label className="m-field"><span className="m-field-label">Início</span><input required type="datetime-local" className="m-input" value={formBloqueio.inicioEm} onChange={e => setFormBloqueio(a => ({ ...a, inicioEm: e.target.value }))} /></label>
          <label className="m-field"><span className="m-field-label">Fim</span><input required type="datetime-local" className="m-input" value={formBloqueio.fimEm} onChange={e => setFormBloqueio(a => ({ ...a, fimEm: e.target.value }))} /></label>
          <label className="m-field"><span className="m-field-label">Motivo</span><input required minLength={2} maxLength={100} className="m-input" value={formBloqueio.tipo} onChange={e => setFormBloqueio(a => ({ ...a, tipo: e.target.value }))} /></label>
          {erro && <p role="alert" className="col-span-full text-sm text-red-700">{erro}</p>}</form></Dialog>}
      {aberto&&<Dialog title={selecionado?'Editar atendimento':'Novo atendimento'} subtitle="Selecione o paciente, serviço e horário de atendimento." wide onClose={()=>{if(!carregando)setAberto(false)}} footer={<><button className="m-btn secondary" disabled={carregando} onClick={()=>setAberto(false)}>Fechar</button><button form="agenda-aberto" type="submit" className="m-btn primary" disabled={carregando || (!selecionado && disponibilidade?.disponivel === false)}>{carregando?'Salvando...':selecionado?'Salvar alterações':'Agendar atendimento'}</button></>}><form id="agenda-aberto" onSubmit={salvar} className="m-form-grid"><label className="m-field span-2"><span className="m-field-label">Paciente</span><select required className="m-input" value={formulario.pacienteId} onChange={(evento) => setFormulario((atual) => ({ ...atual, pacienteId: evento.target.value }))}><option value="">Selecione</option>{pacientes.filter(p=>p.ativo||p.id===selecionado?.pacienteId).map((paciente) => <option value={paciente.id} key={paciente.id}>{paciente.nomeCompleto}</option>)}</select></label>
        <label className="m-field"><span className="m-field-label">Profissional</span><select required className="m-input" value={formulario.profissionalId} onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalId: evento.target.value, servicoId: '' }))}><option value="">Selecione</option>{profissionais.filter(p=>p.ativo||p.id===selecionado?.profissionalId).map((profissional) => <option value={profissional.id} key={profissional.id}>{profissional.nome}</option>)}</select></label>
        <label className="m-field"><span className="m-field-label">Serviço</span><select required className="m-input" value={formulario.servicoId} onChange={(evento) => setFormulario((atual) => ({ ...atual, servicoId: evento.target.value }))}><option value="">Selecione</option>{servicosDisponiveis.map((servico) => <option value={servico.id} key={servico.id}>{servico.nome} · {servico.duracaoMinutos} min</option>)}</select></label>
        <label className="m-field"><span className="m-field-label">Início</span><input required type="datetime-local" className="m-input" value={formulario.inicioEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioEm: evento.target.value }))} /></label>
        {erro && <p role="alert" className="col-span-full text-sm text-red-700">{erro}</p>}
        <label className="m-field"><span className="m-field-label">Sala (opcional)</span><select className="m-input" value={salaId} onChange={e => setSalaId(e.target.value)}><option value="">Sem sala definida</option>{salas.filter(s => s.ativo || s.id === salaId).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.capacidade} vagas)</option>)}</select></label>
        {!selecionado && <div className="col-span-full m-form-grid m-agenda-recurrence"><div className="col-span-full"><h3>Recorrência</h3><p>Crie uma sessão única ou uma sequência de atendimentos.</p></div>
          <label className="m-field"><span className="m-field-label">Quantidade de sessões</span><input type="number" min={1} max={52} required className="m-input" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} /></label>
          {quantidade > 1 && <label className="m-field"><span className="m-field-label">Intervalo</span><select className="m-input" value={intervaloSemanas} onChange={e => setIntervaloSemanas(Number(e.target.value))}>{[1,2,3,4].map(n => <option key={n} value={n}>A cada {n} semana(s)</option>)}</select></label>}
        </div>}
        {quantidade > 1 && !selecionado && <p className="col-span-full text-sm text-slate-600">Todas as sessões precisam estar livres. Se houver conflito, nenhuma será criada.</p>}
        {!selecionado && disponibilidade && <p role="status" className={disponibilidade.disponivel ? 'text-sm text-green-700' : 'text-sm text-red-700'}>{disponibilidade.disponivel ? disponibilidade.vagasRestantes + ' vaga(s) disponível(is)' : 'Horário indisponível'}</p>}
        {selecionado && <div className="col-span-full flex flex-wrap gap-2 border-t pt-4 text-sm">
            {perfil==='ADMINISTRADOR'&&<Link href={'/sistema/financeiro?agendamento=' + encodeURIComponent(selecionado.id) + '&paciente=' + encodeURIComponent(selecionado.pacienteId)} className="rounded-lg border border-slate-300 px-3 py-2">Plano e sessão</Link>}
            <Link href={'/sistema/formularios?agendamento=' + encodeURIComponent(selecionado.id)} className="rounded-lg border border-slate-300 px-3 py-2">Pré-consulta</Link>
          <button type="button" onClick={() => mudarSituacao('CONFIRMADO')} className="rounded-lg border border-slate-300 px-3 py-2">Confirmar</button>
          <button type="button" onClick={() => mudarSituacao('CONCLUIDO')} className="rounded-lg border border-slate-300 px-3 py-2">Concluir</button>
          <button type="button" onClick={() => mudarSituacao('NAO_COMPARECEU')} className="rounded-lg border border-slate-300 px-3 py-2">Falta</button>
          <button type="button" onClick={() => mudarSituacao('CANCELADO')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Cancelar</button>
        </div>}</form></Dialog>}
  </>
}
