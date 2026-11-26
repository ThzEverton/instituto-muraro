'use client'
import { Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Activity, CalendarDays, ClipboardCheck, ClipboardList, FileText, LayoutDashboard, ListChecks, LogOut, Menu, MessageCircle, Settings2, Stethoscope, UserRound, Users, WalletCards, X, ShieldCheck } from 'lucide-react'
import { ErrorNote } from '@/components/physio/ui'
import '@/app/physio.css'

type Perfil='ADMINISTRADOR'|'RECEPCAO'|'FISIOTERAPEUTA'
type Sessao={id:string;perfil:Perfil;nome?:string}
const equipe=['ADMINISTRADOR','RECEPCAO']
const admin=['ADMINISTRADOR']
const fisio=['FISIOTERAPEUTA']
const rotas=[
 {grupo:'PRINCIPAL',href:'/sistema',nome:'Visão geral',Icon:LayoutDashboard,perfis:equipe},
 {grupo:'PRINCIPAL',href:'/sistema/agenda',nome:'Agenda',Icon:CalendarDays,perfis:equipe},
 {grupo:'PRINCIPAL',href:'/sistema/pacientes',nome:'Pacientes',Icon:Users,perfis:equipe},
 {grupo:'PRINCIPAL',href:'/sistema/profissionais',nome:'Fisioterapeutas',Icon:Stethoscope,perfis:equipe},
 {grupo:'PRINCIPAL',href:'/sistema/servicos',nome:'Serviços',Icon:ListChecks,perfis:equipe},
 {grupo:'GESTÃO CLÍNICA',href:'/sistema/prontuario',nome:'Prontuário e avaliações',Icon:ClipboardCheck,perfis:fisio},
 {grupo:'GESTÃO CLÍNICA',href:'/sistema/financeiro?aba=Planos',nome:'Planos e mensalidades',Icon:Activity,perfis:admin},
 {grupo:'ADMINISTRAÇÃO',href:'/sistema/financeiro',nome:'Financeiro',Icon:WalletCards,perfis:admin},
 {grupo:'ADMINISTRAÇÃO',href:'/sistema/formularios',nome:'Formulários',Icon:ClipboardList,perfis:equipe},
 {grupo:'ADMINISTRAÇÃO',href:'/sistema/comunicacao',nome:'Comunicação',Icon:MessageCircle,perfis:equipe},
 {grupo:'ADMINISTRAÇÃO',href:'/sistema/prontuario',nome:'Acessos clínicos',Icon:UserRound,perfis:admin},
 {grupo:'ADMINISTRAÇÃO',href:'/sistema/financeiro?aba=Configurações',nome:'Configurações',Icon:Settings2,perfis:admin},
]
const nomes:Record<Perfil,string>={ADMINISTRADOR:'Administrador',RECEPCAO:'Recepção',FISIOTERAPEUTA:'Fisioterapeuta'}
async function api<T>(rota:string,method='GET',body?:object):Promise<T>{
 const r=await fetch('/api/sistema/'+rota,{method,cache:'no-store',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.erro||'Falha de conexão'),{status:r.status});return j
}
export default function Layout({children}:{children:ReactNode}){return <Suspense fallback={<p>Carregando sistema...</p>}><Estrutura>{children}</Estrutura></Suspense>}
function Estrutura({children}:{children:ReactNode}){
 const caminho=usePathname(),router=useRouter(),params=useSearchParams()
 const [sessao,setSessao]=useState<Sessao|null>(null)
 const [carregando,setCarregando]=useState(true),[erro,setErro]=useState(''),[mobile,setMobile]=useState(false),[email,setEmail]=useState(''),[senha,setSenha]=useState('')
 useEffect(()=>{api<{dados:Sessao}>('autenticacao/sessao').then(r=>setSessao(r.dados)).catch(e=>{if(e.status!==401)setErro(e.message)}).finally(()=>setCarregando(false))},[])
 useEffect(()=>{setMobile(false)},[caminho])
 useEffect(()=>{
  if(!sessao)return
  if(sessao.perfil==='FISIOTERAPEUTA'&&caminho!=='/sistema/prontuario')router.replace('/sistema/prontuario')
  else if(sessao.perfil==='RECEPCAO'&&['/sistema/financeiro','/sistema/prontuario'].includes(caminho))router.replace('/sistema')
 },[sessao,caminho,router])
 async function entrar(e:FormEvent){e.preventDefault();setCarregando(true);setErro('');try{
  const r=await api<{dados:{usuario:Sessao}}>('autenticacao/entrar','POST',{email,senha})
  setSessao(r.dados.usuario);setSenha('');if(r.dados.usuario.perfil==='FISIOTERAPEUTA')router.replace('/sistema/prontuario')
 }catch(e){setErro(e instanceof Error?e.message:'Falha ao entrar')}finally{setCarregando(false)}}
 async function sair(){setErro('');try{await api('autenticacao/sair','POST',{});setSessao(null);setSenha('');router.replace('/sistema')}catch(e){setErro(e instanceof Error?e.message:'Não foi possível sair')}}
 if(!sessao)return <div className="m-app m-login"><section className="m-login-brand"><img src="/instituto-muraro-logo.png" alt="Instituto Muraro"/><span className="m-eyebrow">GESTÃO EM FISIOTERAPIA</span><h1>Organize cada etapa da recuperação.</h1><p>Agenda, pacientes e gestão da clínica em um só lugar.</p></section><section className="m-login-area"><form className="m-card m-login-form" onSubmit={entrar}><span className="m-eyebrow">ACESSO RESTRITO</span><h1>Bem-vindo ao Instituto Muraro</h1><p>Entre com seu e-mail e senha.</p><label className="m-field"><span className="m-field-label">E-mail</span><input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="m-field"><span className="m-field-label">Senha</span><input autoComplete="current-password" type="password" required value={senha} onChange={e=>setSenha(e.target.value)}/></label>{erro&&<ErrorNote message={erro}/>}<button className="m-btn primary" disabled={carregando}>{carregando?'Verificando...':'Entrar no sistema'}</button><small><ShieldCheck size={15}/> Sessão protegida • acesso por perfil</small></form></section></div>
 const permitidas=rotas.filter(r=>r.perfis.includes(sessao.perfil))
 const aba=params.get('aba');const alvo=caminho+(aba?'?aba='+aba:'')
 const atual=permitidas.find(r=>r.href===alvo)??permitidas.find(r=>r.href===caminho)
 const permitido=sessao.perfil==='FISIOTERAPEUTA'?caminho==='/sistema/prontuario':sessao.perfil==='RECEPCAO'?!['/sistema/financeiro','/sistema/prontuario'].includes(caminho):true
 return <div className="m-app"><aside className={'m-sidebar'+(mobile?' mobile-open':'')}>
 <div className="m-brand"><img src="/instituto-muraro-logo.png" alt="Logo do Instituto Muraro"/><div><strong>Instituto Muraro</strong><span>Gestão em fisioterapia</span></div><button className="m-icon-btn sidebar-close" onClick={()=>setMobile(false)} aria-label="Fechar menu"><X size={19}/></button></div>
 <nav className="m-sidebar-nav" aria-label="Menu principal">{['PRINCIPAL','GESTÃO CLÍNICA','ADMINISTRAÇÃO'].map((grupo,i)=>{const itens=permitidas.filter(r=>r.grupo===grupo);return itens.length>0&&<div key={grupo}><span className={'m-nav-label'+(i?' second':'')}>{grupo}</span>{itens.map(({href,Icon,nome})=><Link key={href+nome} href={href} className={'m-nav-link'+(atual?.nome===nome?' active':'')} onClick={()=>setMobile(false)}><Icon size={19}/><span>{nome}</span>{atual?.nome===nome&&<span className="m-nav-active-dot"/>}</Link>)}</div>})}</nav>
 <div className="m-sidebar-bottom"><div className="m-demo-label"><span className="m-demo-glow"/><div><strong>Ambiente operacional</strong><small>Dados persistentes • acesso restrito</small></div></div><div className="m-sidebar-user"><span className="m-avatar small">{nomes[sessao.perfil].slice(0,2).toUpperCase()}</span><span><strong>{sessao.nome??nomes[sessao.perfil]}</strong><small>{nomes[sessao.perfil]}</small></span><button className="m-icon-btn" title="Sair" onClick={sair}><LogOut size={18}/></button></div></div>
 </aside>{mobile&&<button className="m-mobile-backdrop" onClick={()=>setMobile(false)} aria-label="Fechar menu"/>}
 <div className="m-main"><header className="m-topbar"><button className="m-mobile-menu" onClick={()=>setMobile(true)} aria-label="Abrir menu"><Menu size={22}/></button><div className="m-breadcrumb"><span>Instituto Muraro</span><span className="m-breadcrumb-sep">/</span><strong>{atual?.nome??'Cadastros'}</strong></div><div className="m-topbar-actions"><span className="m-online"><i/> Sessão ativa</span><div className="m-top-avatar">{nomes[sessao.perfil].slice(0,2).toUpperCase()}</div></div></header><main className="m-main-inner">{erro&&<ErrorNote message={erro}/>}<div className="m-integrado">{permitido?<Suspense fallback={<p>Carregando módulo...</p>}>{children}</Suspense>:<p>Redirecionando...</p>}</div></main><footer className="m-footer">Instituto Muraro • Gestão em fisioterapia <span>Desenvolvimento ETH Tecnologia</span></footer></div></div>
}
