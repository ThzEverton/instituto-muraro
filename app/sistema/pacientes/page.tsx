'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Edit3, Eye, Archive, X, CalendarDays, WalletCards, MessageCircle } from 'lucide-react'
import { SectionHeader, Badge, Dialog, Inputs, Table, PillButton, ErrorNote, SearchFilter, type FieldDef } from '@/components/physio/ui'
import { patientAge } from '@/lib/physio-model'
import Link from 'next/link'

type Paciente = {
  id: string
  nomeCompleto: string
  cpf: string | null
  dataNascimento: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  endereco: string | null
  responsavelLegal: string | null
  contatoEmergencia: string | null
  observacoesAdministrativas: string | null
  formaAtendimento: string | null
  ativo: boolean
  whatsappAutorizado: string | null
  autorizadoWhatsAppEm: string | null
}

type Formulario = {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  telefone: string
  whatsapp: string
  email: string
  endereco: string
  responsavelLegal: string
  contatoEmergencia: string
  observacoesAdministrativas: string
  formaAtendimento: string
}

const formularioVazio: Formulario = {
  nomeCompleto: '', cpf: '', dataNascimento: '', telefone: '', whatsapp: '',
  email: '', endereco: '', responsavelLegal: '', contatoEmergencia: '',
  observacoesAdministrativas: '', formaAtendimento: '',
}

async function requisitar<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/sistema/${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...opcoes?.headers },
    cache: 'no-store',
  })
  const corpo = await resposta.json()
  if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível concluir a operação')
  return corpo as T
}

export default function Sistema() {
  const [perfil, setPerfil] = useState('')
  const [detalhe,setDetalhe]=useState<Paciente|null>(null)
  const [filtro,setFiltro]=useState('')
  const [total,setTotal]=useState(0)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [formulario, setFormulario] = useState<Formulario>(formularioVazio)
  const [edicaoId, setEdicaoId] = useState<string | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async (termo = busca, numero = pagina) => {
    const parametros = new URLSearchParams({ pagina: String(numero), limite: '20' })
    if (filtro) parametros.set('ativo',filtro)
    if (termo.trim()) parametros.set('busca', termo.trim())
    const resposta = await requisitar<{
      dados: Paciente[]
      paginacao: { totalPaginas: number; totalRegistros:number }
    }>(`pacientes?${parametros}`)
    setPacientes(resposta.dados)
    setTotal(resposta.paginacao.totalRegistros)
    setDetalhe(d=>d?resposta.dados.find(p=>p.id===d.id)??null:null)
    setTotalPaginas(Math.max(1, resposta.paginacao.totalPaginas))
  }, [busca, pagina, filtro])

  useEffect(()=>{
    requisitar<{dados:{perfil:string}}>('autenticacao/sessao').then(r=>{setPerfil(r.dados.perfil)}).catch(e=>setErro(e.message))
    if(new URLSearchParams(window.location.search).get('novo')==='1')abrirNovo()
  },[])
  useEffect(()=>{
    const t=setTimeout(()=>carregar(busca,pagina).catch(e=>setErro(e.message)),250)
    return ()=>clearTimeout(t)
  },[carregar,busca,pagina])
  async function alterarAutorizacao(paciente:Paciente) {
    const aceita=!paciente.autorizadoWhatsAppEm
    if(!window.confirm(aceita?'Confirma que o paciente autorizou o contato por WhatsApp neste numero?':'Revogar a autorizacao de contato?'))return
    try {await requisitar('comunicacao/pacientes/'+paciente.id+'/autorizacao',{method:'PATCH',body:JSON.stringify({aceita})});await carregar()}
    catch(e){setErro(e instanceof Error?e.message:'Falha ao atualizar autorizacao')}
  }
  function abrirNovo() {
    setFormulario(formularioVazio)
    setEdicaoId(null)
    setMostrarFormulario(true)
    setErro('')
  }

  function abrirEdicao(paciente: Paciente) {
    setFormulario({
      nomeCompleto: paciente.nomeCompleto,
      cpf: paciente.cpf ?? '',
      dataNascimento: paciente.dataNascimento?.slice(0, 10) ?? '',
      telefone: paciente.telefone ?? '',
      whatsapp: paciente.whatsapp ?? '',
      email: paciente.email ?? '',
      endereco: paciente.endereco ?? '',
      responsavelLegal: paciente.responsavelLegal ?? '',
      contatoEmergencia: paciente.contatoEmergencia ?? '',
      observacoesAdministrativas: paciente.observacoesAdministrativas ?? '',
      formaAtendimento: paciente.formaAtendimento ?? '',
    })
    setEdicaoId(paciente.id)
    setMostrarFormulario(true)
    setErro('')
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErro('')
    setCarregando(true)
    const dados = Object.fromEntries(
      Object.entries(formulario)
        .filter(([chave, valor]) => chave === 'nomeCompleto' || Boolean(valor.trim()) || Boolean(edicaoId))
        .map(([chave, valor]) => [chave, valor.trim() || null]),
    )
    if (dados.cpf) dados.cpf = String(dados.cpf).replace(/\D/g, '')
    try {
      await requisitar(edicaoId ? `pacientes/${edicaoId}` : 'pacientes', {
        method: edicaoId ? 'PATCH' : 'POST',
        body: JSON.stringify(dados),
      })
      setMostrarFormulario(false)
      await carregar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha ao salvar')
    } finally {
      setCarregando(false)
    }
  }

  async function alterarAtividade(paciente: Paciente) {
    if(!window.confirm(paciente.ativo?'Inativar paciente preservando o histórico?':'Reativar paciente?'))return
    setErro('')
    try {
      await requisitar(`pacientes/${paciente.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !paciente.ativo }),
      })
      await carregar()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha ao atualizar')
    }
  }

  const campos:FieldDef[]=[
   {key:'nomeCompleto',label:'Nome completo',required:true,wide:true},
   {key:'dataNascimento',label:'Data de nascimento',type:'date'},
   {key:'cpf',label:'CPF (opcional)'},
   {key:'telefone',label:'Telefone',type:'tel'},
   {key:'whatsapp',label:'WhatsApp',type:'tel'},
   {key:'email',label:'E-mail',type:'email'},
   {key:'endereco',label:'Endereço / cidade',wide:true},
   {key:'formaAtendimento',label:'Forma de atendimento'},
   {key:'responsavelLegal',label:'Responsável legal'},
   {key:'contatoEmergencia',label:'Contato de emergência'},
   {key:'observacoesAdministrativas',label:'Observações administrativas',type:'textarea',wide:true},
  ]
  const iniciais=(nome:string)=>nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()
  return <>
    <SectionHeader eyebrow="CADASTROS" title="Pacientes" description="Dados administrativos, histórico de atendimentos e acompanhamento." actions={<button className="m-btn primary" onClick={abrirNovo}><Plus size={17}/> Adicionar paciente</button>}/>
    <section className="m-card">
      <div className="m-module-intro"><div><h2>Cadastro de pacientes</h2><p>{total} registros encontrados</p></div></div>
      <SearchFilter search={busca} setSearch={v=>{setBusca(v);setPagina(1)}} filter={filtro} setFilter={v=>{setFiltro(v);setPagina(1)}} options={[{label:'Todos os status',value:''},{label:'Ativos',value:'true'},{label:'Inativos',value:'false'}]} placeholder="Buscar paciente por nome..."/>
      {erro&&!mostrarFormulario&&<ErrorNote message={erro}/>}
      <Table<Paciente> rows={pacientes} pageSize={20} columns={[
       {label:'Paciente',cell:p=><div className="m-name-cell"><span className="m-avatar">{iniciais(p.nomeCompleto)}</span><span><strong>{p.nomeCompleto}</strong><small>{p.email||'Sem e-mail cadastrado'}</small></span></div>},
       {label:'Contato',cell:p=><div className="m-two-line"><strong>{p.telefone||p.whatsapp||'—'}</strong><small>{p.endereco||'Cidade não informada'}</small></div>},
       {label:'Idade',cell:p=>patientAge(p.dataNascimento?.slice(0,10)??'')},
       {label:'Atendimento',cell:p=>p.formaAtendimento||'—'},
       {label:'Situação',cell:p=><Badge tone={p.ativo?'green':'red'}>{p.ativo?'Ativo':'Inativo'}</Badge>},
      ]} onRowClick={p=>setDetalhe(p)} actions={p=><><PillButton title="Ver perfil" onClick={()=>setDetalhe(p)}><Eye size={16}/></PillButton><PillButton title="Editar" onClick={()=>abrirEdicao(p)}><Edit3 size={17}/></PillButton><PillButton title={p.ativo?'Inativar':'Reativar'} variant={p.ativo?'danger':'success'} onClick={()=>alterarAtividade(p)}><Archive size={17}/></PillButton></>}/>
      <div className="m-table-footer"><span>Página {pagina} de {totalPaginas}</span><div className="m-page-nav"><button disabled={pagina<=1} onClick={()=>setPagina(pagina-1)}>Anterior</button><button disabled={pagina>=totalPaginas} onClick={()=>setPagina(pagina+1)}>Próxima</button></div></div>
    </section>
    {detalhe&&<div className="m-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDetalhe(null)}}><section className="m-profile-panel" role="dialog" aria-modal="true" aria-label="Perfil administrativo">
      <header className="m-profile-top"><div className="m-profile-ident"><span className="m-avatar">{iniciais(detalhe.nomeCompleto)}</span><div><span className="m-eyebrow">CADASTRO ADMINISTRATIVO</span><h2>{detalhe.nomeCompleto}</h2><small>{patientAge(detalhe.dataNascimento?.slice(0,10)??'')} • {detalhe.formaAtendimento||'Não informado'}</small></div></div><button className="m-icon-btn" onClick={()=>setDetalhe(null)} aria-label="Fechar perfil"><X size={20}/></button></header>
      <div className="m-profile-tags"><Badge tone={detalhe.ativo?'green':'red'}>{detalhe.ativo?'Ativo':'Inativo'}</Badge><Badge tone={detalhe.autorizadoWhatsAppEm?'green':'neutral'}>{detalhe.autorizadoWhatsAppEm?'WhatsApp autorizado':'WhatsApp não autorizado'}</Badge></div>
      <div className="m-profile-content"><h3>Dados e contatos</h3><div className="m-profile-grid">{campos.filter(c=>c.key!=='nomeCompleto').map(c=><div key={c.key} className={c.wide?'full':''}><span>{c.label}</span><strong>{String(detalhe[c.key as keyof Paciente]??'—')}</strong></div>)}</div>
      <div className="m-profile-actions"><button className="m-btn secondary" onClick={()=>alterarAutorizacao(detalhe)}><MessageCircle size={16}/>{detalhe.autorizadoWhatsAppEm?'Revogar WhatsApp':'Autorizar WhatsApp'}</button><button className="m-btn secondary" onClick={()=>{abrirEdicao(detalhe);setDetalhe(null)}}><Edit3 size={16}/> Editar cadastro</button><Link className="m-btn primary" href={'/sistema/agenda?novo=1&paciente='+encodeURIComponent(detalhe.id)}><CalendarDays size={16}/> Agendar sessão</Link></div>
      {perfil==='ADMINISTRADOR'&&<div className="m-profile-actions"><Link href={'/sistema/financeiro?paciente='+encodeURIComponent(detalhe.id)} className="m-btn secondary"><WalletCards size={16}/> Financeiro do paciente</Link></div>}
      </div><footer className="m-profile-footer">Conteúdo clínico reservado aos profissionais autorizados.</footer>
    </section></div>}
    {mostrarFormulario&&<Dialog title={edicaoId?'Editar paciente':'Novo paciente'} subtitle="Cadastro administrativo persistente" wide onClose={()=>setMostrarFormulario(false)} footer={<><button className="m-btn secondary" onClick={()=>setMostrarFormulario(false)}>Cancelar</button><button type="submit" form="form-paciente" disabled={carregando} className="m-btn primary">Salvar alterações</button></>}>
      <form id="form-paciente" onSubmit={salvar}><Inputs fields={campos} form={formulario} onChange={(k,v)=>setFormulario(f=>({...f,[k]:v}))}/>{erro&&<ErrorNote message={erro}/>}</form>
    </Dialog>}
  </>
}
