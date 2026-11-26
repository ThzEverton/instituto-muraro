'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {Activity,ArrowRight,CalendarDays,CheckCircle2,ClipboardCheck,ClipboardList,CreditCard,HeartPulse,Plus,TrendingUp,UserRoundPlus,Users,WalletCards} from 'lucide-react'
import {Badge,Empty,ErrorNote,Metric,SectionHeader,stateTone} from '@/components/physio/ui'
import {money,fmtDate} from '@/lib/physio-model'
type Resumo={data:string;pacientesAtivos:number;atendimentosHoje:number;sessoesConcluidas:number;agenda:{id:string;inicioEm:string;situacao:string;paciente:{nomeCompleto:string};profissional:{nome:string};servico:{nome:string}}[];financeiro:{recebidoMesCentavos:number;planosAtivos:number;cobrancasVencidas:number}|null}
const situacoes:Record<string,string>={AGENDADO:'Agendado',AGUARDANDO_CONFIRMACAO:'Aguardando confirmação',CONFIRMADO:'Confirmado',EM_ATENDIMENTO:'Em atendimento',CONCLUIDO:'Concluído',NAO_COMPARECEU:'Não compareceu'}
export default function Painel(){
 const [dados,setDados]=useState<Resumo|null>(null),[erro,setErro]=useState('')
 useEffect(()=>{fetch('/api/sistema/painel/resumo',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.erro);setDados(j.dados)}).catch(e=>setErro(e.message))},[])
 const f=dados?.financeiro
 return <>
 <SectionHeader eyebrow="PAINEL DE CONTROLE" title="Um bom dia para cuidar de pessoas." description={'Resumo da clínica'+(dados?' • '+fmtDate(dados.data):'')} actions={<div className="m-inline-actions"><Link className="m-btn secondary" href="/sistema/agenda"><CalendarDays size={16}/> Ver agenda</Link><Link className="m-btn primary" href="/sistema/agenda?novo=1"><Plus size={17}/> Novo agendamento</Link></div>}/>
 {erro&&<ErrorNote message={erro}/>}
 <div className="m-metrics">
 <Metric label="Atendimentos hoje" value={dados?.atendimentosHoje??'—'} caption="Sessões e avaliações agendadas" icon={<CalendarDays size={19}/>}/>
 <Metric label="Pacientes ativos" value={dados?.pacientesAtivos??'—'} caption="Em acompanhamento na clínica" icon={<Users size={19}/>} accent="navy"/>
 <Metric label="Sessões concluídas hoje" value={dados?.sessoesConcluidas??'—'} caption="Atendimentos finalizados" icon={<ClipboardCheck size={19}/>} accent="amber"/>
 {f&&<Metric label="Recebido no mês" value={money(f.recebidoMesCentavos)} caption="Recebimentos menos estornos" icon={<TrendingUp size={19}/>} accent="teal"/>}
 </div>
 <div className="m-dash-grid">
 <section className={"m-card m-today-card"+(dados?.agenda.length===0?" m-today-empty":"")}><div className="m-card-head"><div><span className="m-eyebrow">PROGRAMAÇÃO</span><h2>Agenda de hoje</h2><p>Atendimentos programados para este dia</p></div><Link className="m-text-btn" href="/sistema/agenda">Agenda completa <ArrowRight size={16}/></Link></div>
 <div className="m-day-list">{!dados?<p>{erro?'Não foi possível carregar a agenda.':'Carregando agenda...'}</p>:dados.agenda.length===0?<Empty title="Agenda livre para hoje" description="Agende um novo atendimento para visualizar aqui."/>:dados.agenda.map(a=><div className="m-day-item" key={a.id}><time>{new Date(a.inicioEm).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})}</time><span className="m-day-line"/><div className="m-day-info"><strong>{a.paciente.nomeCompleto}</strong><span>{a.servico.nome}</span><small>{a.profissional.nome}</small></div><Badge tone={stateTone(situacoes[a.situacao]??a.situacao)}>{situacoes[a.situacao]??a.situacao}</Badge></div>)}</div>
 </section>
 <div className="m-dash-side"><section className="m-feature-card"><span className="m-feature-icon"><HeartPulse size={25}/></span><span className="m-feature-kicker">ACOMPANHAMENTO FISIOTERAPÊUTICO</span><h2>Organize cada etapa da recuperação.</h2><p>Pacientes, agenda e acompanhamento das sessões em um só lugar.</p><Link href={f?'/sistema/financeiro?aba=Planos':'/sistema/pacientes'} className="m-btn secondary">{f?'Ver planos e mensalidades':'Ver pacientes'} <ArrowRight size={17}/></Link><div className="m-feature-art"><span/><span/><span/></div></section>
 <section className="m-card m-brief"><div className="m-card-head"><div><h2>Indicadores rápidos</h2><p>O que merece atenção</p></div></div>{f&&<><div className="m-brief-line"><span><ClipboardList size={17}/> Contratos vigentes</span><strong>{f.planosAtivos}</strong></div><div className="m-brief-line"><span><CreditCard size={17}/> Cobranças vencidas</span><strong className={f.cobrancasVencidas>0?'warning':''}>{f.cobrancasVencidas}</strong></div></>}<div className="m-brief-line"><span><CheckCircle2 size={17}/> Sessões concluídas hoje</span><strong>{dados?.sessoesConcluidas??'—'}</strong></div></section></div></div>
 <section className="m-card m-quick-card"><div className="m-card-head"><div><h2>Acesso rápido</h2><p>Principais tarefas do dia a dia</p></div></div><div className="m-quick-grid"><Link href="/sistema/pacientes?novo=1"><span><UserRoundPlus size={20}/></span><strong>Cadastrar paciente</strong><small>Dados e contatos</small></Link><Link href="/sistema/formularios"><span><ClipboardCheck size={20}/></span><strong>Pré-consulta</strong><small>Formulários e links</small></Link>{f&&<><Link href="/sistema/financeiro?aba=Planos"><span><Activity size={20}/></span><strong>Planos</strong><small>Contratos e sessões</small></Link><Link href="/sistema/financeiro?aba=Cobran%C3%A7as"><span><WalletCards size={20}/></span><strong>Nova cobrança</strong><small>Controle financeiro</small></Link></>}</div></section>
 </>
}
