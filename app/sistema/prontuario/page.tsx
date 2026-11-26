'use client'
import {usePerfilSessao} from '@/lib/sessao-interface'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {SectionHeader,Empty,Badge} from '@/components/physio/ui'

type Paciente = { id: string; nomeCompleto: string; ativo: boolean }
type Profissional = { id: string; nome: string; usuarioId: string | null }
type Conta = { id: string; nome: string; email: string; profissional: { id: string } | null }
type Vinculo = { id: string; pacienteId: string; ativo: boolean; paciente: { nomeCompleto: string } }
type Entrada = { id: string; autorId: string; autorNome: string | null; autorRegistro: string | null; tipo: string; texto: string; situacao: string; versao: number; criadaEm: string; finalizadaEm: string | null }
type RespostaFormulario = { id: string; enviadaEm: string; respostas: Record<string, string | number | boolean | null>; link: { agendamentoId: string; modelo: { titulo: string; versao: number; perguntas: { id: string; rotulo: string }[] } } }
type Prontuario = { paciente: Paciente; entradas: Entrada[]; usuarioId: string; formularios: RespostaFormulario[] }
const tipos = [['ANAMNESE','Anamnese'],['AVALIACAO','Avaliação clínica'],['EVOLUCAO','Evolução'],['ADENDO','Adendo / correção']]
const campo = 'm-input mt-1 w-full'
const botao = 'm-btn primary'
const secundario = 'm-btn secondary'
async function api<T>(rota: string, metodo = 'GET', corpo?: object): Promise<T> {
  const r = await fetch('/api/sistema/' + rota, { method: metodo, headers: { 'Content-Type': 'application/json' }, cache: 'no-store', ...(corpo ? { body: JSON.stringify(corpo) } : {}) })
  const json = await r.json()
  if (!r.ok) throw new Error(json.erro || 'Falha na operação')
  return json
}
const mensagem = (e: unknown) => e instanceof Error ? e.message : 'Falha na operação'

export default function Clinica() {
  const perfil=usePerfilSessao()
  const [erro, setErro] = useState('')
  async function sair() {
    try { await api('autenticacao/sair', 'POST', {}); window.location.replace('/sistema') }
    catch (e) { setErro(mensagem(e)) }
  }
  return <div className="m-modulo space-y-5">
    <SectionHeader eyebrow="GESTÃO CLÍNICA" title={perfil === 'ADMINISTRADOR' ? 'Gestão de acessos clínicos' : 'Prontuário clínico'} description="Registros e acessos clínicos conforme perfil."/>
      {erro && <p role="alert" className="mb-3 ux-erro">{erro}</p>}
      {!perfil && <p>Verificando sessão...</p>}
      {perfil === 'ADMINISTRADOR' && <Gestao />}
      {perfil === 'FISIOTERAPEUTA' && <Prontuarios />}
      {perfil === 'RECEPCAO' && <p>O conteúdo clínico não está disponível para a recepção.</p>}

  </div>
}

function Gestao() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [profissionalId, setProfissionalId] = useState('')
  const [pacienteId, setPacienteId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [busca, setBusca] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  async function carregar() {
    const [p,c] = await Promise.all([api<{ dados: Profissional[] }>('profissionais?ativo=true&limite=100'),api<{ dados: Conta[] }>('clinica/contas')])
    setProfissionais(p.dados); setContas(c.dados)
  }
  async function buscarPacientes(numero = 1) {
    const r = await api<{ dados: Paciente[]; paginacao: { totalPaginas: number } }>('pacientes?' + new URLSearchParams({ ativo: 'true', busca, limite: '20', pagina: String(numero) }))
    setPacientes(r.dados); setPagina(numero); setTotalPaginas(Math.max(1,r.paginacao.totalPaginas)); setPacienteId('')
  }
  useEffect(() => { carregar().catch(e => setErro(mensagem(e))) }, [])
  useEffect(() => {
    setVinculos([]); setUsuarioId(''); setSenha(''); setEmail('')
    if (!profissionalId) return
    let atual = true
    api<{ dados: Vinculo[] }>('clinica/vinculos?' + new URLSearchParams({ profissionalId })).then(r => {if (atual) setVinculos(r.dados)}).catch(e => {if (atual) setErro(mensagem(e))})
    return () => { atual = false }
  }, [profissionalId])
  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true); setErro('')
    try { await acao(); await carregar(); if (profissionalId) setVinculos((await api<{ dados: Vinculo[] }>('clinica/vinculos?' + new URLSearchParams({ profissionalId }))).dados) }
    catch(e) {setErro(mensagem(e))}
    finally {setOcupado(false); setSenha('')}
  }
  const profissional = profissionais.find(p => p.id === profissionalId)
  return <section className="space-y-6 m-card">
    <div className="m-clinical-notice"><div><strong>Controle de acesso clínico</strong><p>1. Escolha um profissional. 2. Crie ou associe sua conta. 3. Autorize apenas os pacientes que ele atende. Administradores não acessam o conteúdo dos prontuários.</p></div></div>
    {erro && <p role="alert" className="text-sm ux-erro">{erro}</p>}
    <label className="block text-sm">Profissional<select className={campo} value={profissionalId} disabled={ocupado} onChange={e => setProfissionalId(e.target.value)}><option value="">Selecione</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    {!profissional&&<Empty title="Selecione um fisioterapeuta" description="Escolha um profissional para administrar sua conta e os vínculos com pacientes."/>}
    {profissional && <>
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Conta de acesso</h2>
        {profissional.usuarioId ? <p className="text-sm">Conta associada: {contas.find(c => c.id === profissional.usuarioId)?.email ?? 'Conta cadastrada'}</p> : <>
          <form className="space-y-3" onSubmit={e => {e.preventDefault(); void executar(() => api('clinica/contas','POST',{ profissionalId,email,senha }))}}>
            <label className="block text-sm">E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={campo}/></label>
            <label className="block text-sm">Senha inicial (mínimo de 12 caracteres)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={senha} onChange={e => setSenha(e.target.value)} className={campo}/></label>
            <button className={botao} disabled={ocupado}>Criar conta de fisioterapeuta</button>
          </form>
          <form className="space-y-3 border-t pt-3" onSubmit={e => {e.preventDefault(); void executar(() => api('clinica/associacoes','POST',{ profissionalId,usuarioId }))}}>
            <label className="block text-sm">Ou associar conta existente<select className={campo} required value={usuarioId} onChange={e => setUsuarioId(e.target.value)}><option value="">Selecione</option>{contas.filter(c => !c.profissional).map(c => <option key={c.id} value={c.id}>{c.nome} — {c.email}</option>)}</select></label>
            <button className={secundario} disabled={ocupado || !usuarioId}>Associar</button>
          </form>
        </>}
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Pacientes autorizados</h2>
        <form className="flex flex-wrap gap-2" onSubmit={e => {e.preventDefault(); buscarPacientes().catch(e => setErro(mensagem(e)))}}><input className="min-w-48 flex-1 rounded-lg border p-2" placeholder="Buscar paciente por nome" value={busca} onChange={e => setBusca(e.target.value)}/><button className={secundario}>Buscar</button></form>
        <div className="flex items-center gap-2 text-sm"><button className={secundario} disabled={pagina <= 1} onClick={() => buscarPacientes(pagina-1).catch(e => setErro(mensagem(e)))}>Anterior</button><span>{pagina}/{totalPaginas}</span><button className={secundario} disabled={pagina >= totalPaginas} onClick={() => buscarPacientes(pagina+1).catch(e => setErro(mensagem(e)))}>Próxima</button></div>
        <select className={campo} value={pacienteId} onChange={e => setPacienteId(e.target.value)}><option value="">Selecione o paciente</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nomeCompleto}</option>)}</select>
        <button className={botao} disabled={!pacienteId || ocupado} onClick={() => executar(() => api('clinica/vinculos','POST',{ pacienteId,profissionalId,ativo:true }))}>Autorizar acesso</button>
        <ul className="divide-y">{vinculos.map(v => <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span>{v.paciente.nomeCompleto} <small>({v.ativo ? 'Autorizado' : 'Revogado'})</small></span><button className={secundario} disabled={ocupado} onClick={() => {if (window.confirm(v.ativo ? 'Revogar acesso a este paciente?' : 'Reativar acesso?')) void executar(() => api('clinica/vinculos','POST',{ pacienteId:v.pacienteId,profissionalId,ativo:!v.ativo }))}}>{v.ativo ? 'Revogar' : 'Reativar'}</button></li>)}</ul>
      </div>
    </>}
  </section>
}

function Prontuarios() {
  const [pacientes,setPacientes] = useState<Paciente[]>([])
  const [busca,setBusca] = useState('')
  const [pagina,setPagina] = useState(1)
  const [total,setTotal] = useState(0)
  const [id,setId] = useState('')
  const [prontuario,setProntuario] = useState<Prontuario | null>(null)
  const [erro,setErro] = useState('')
  const [ocupado,setOcupado] = useState(false)
  const [tipo,setTipo] = useState('EVOLUCAO')
  const [texto,setTexto] = useState('')
  const [edicao,setEdicao] = useState<Entrada | null>(null)
  async function buscar(numero=1, termo=busca) {
    const r = await api<{ dados: Paciente[]; total: number }>('clinica/pacientes?' + new URLSearchParams({ busca:termo, pagina:String(numero) }))
    setPacientes(r.dados); setPagina(numero); setTotal(r.total)
  }
  useEffect(() => {buscar(1,'').catch(e => setErro(mensagem(e)))},[])
  const rota = 'clinica/pacientes/' + encodeURIComponent(id) + '/prontuario'
  async function abrir(pacienteId: string) {
    setOcupado(true); setProntuario(null); setEdicao(null); setTexto(''); setTipo('EVOLUCAO'); setErro(''); setId(pacienteId)
    try {setProntuario((await api<{dados:Prontuario}>('clinica/pacientes/' + encodeURIComponent(pacienteId) + '/prontuario')).dados)}
    catch(e) {setErro(mensagem(e))}
    finally {setOcupado(false)}
  }
  async function salvar(finalizar: boolean) {
    if (!texto.trim() || !id || !prontuario) return
    if (finalizar && !window.confirm('Finalizar este registro? Depois não poderá ser alterado.')) return
    setOcupado(true); setErro('')
    try {
      let registro = edicao
      if (!registro) {
        registro = (await api<{dados:Entrada}>(rota,'POST',{tipo,texto})).dados
        setEdicao(registro)
      }
      if (edicao || finalizar) {
        registro = (await api<{dados:Entrada}>(rota + '/' + registro.id,'PATCH',{tipo,texto,versao:registro.versao,finalizar})).dados
      }
      setProntuario((await api<{dados:Prontuario}>(rota)).dados)
      setEdicao(null); setTexto(''); setTipo('EVOLUCAO')
    } catch(e) {setErro(mensagem(e))}
    finally {setOcupado(false)}
  }
  return <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
    <aside className="m-card space-y-3 m-clinical-patients"><h2 className="font-semibold">Meus pacientes</h2>
      <form className="flex gap-2" onSubmit={e => {e.preventDefault(); buscar().catch(e => setErro(mensagem(e)))}}><input className="min-w-0 flex-1 rounded-lg border p-2" placeholder="Nome" value={busca} onChange={e => setBusca(e.target.value)}/><button className={secundario}>Buscar</button></form>
      {pacientes.map(p => <button key={p.id} disabled={ocupado} className={'block w-full rounded-lg border p-3 text-left text-sm ' + (p.id === id ? 'ux-borda-selecao ux-selecao' : '')} onClick={() => abrir(p.id)}>{p.nomeCompleto}{!p.ativo && ' (inativo)'}</button>)}
      {!pacientes.length && <Empty title="Nenhum paciente encontrado" description="Verifique a pesquisa ou solicite ao administrador o vínculo clínico."/>}
      <div className="flex justify-between text-sm"><button className={secundario} disabled={pagina<=1} onClick={() => buscar(pagina-1).catch(e => setErro(mensagem(e)))}>Anterior</button><button className={secundario} disabled={pagina*50>=total} onClick={() => buscar(pagina+1).catch(e => setErro(mensagem(e)))}>Próxima</button></div>
    </aside>
    <section className="space-y-5 m-card">
      {erro && <p role="alert" className="text-sm ux-erro">{erro}</p>}
      {!prontuario && <Empty title="Selecione um paciente" description="Escolha um paciente autorizado para consultar ou registrar o acompanhamento clínico."/>}
      {prontuario && <>
        <h2 className="text-xl font-semibold">{prontuario.paciente.nomeCompleto}</h2>
        {prontuario.paciente.ativo && <form onSubmit={(e:FormEvent) => {e.preventDefault(); void salvar(false)}} className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">{edicao ? 'Editar rascunho' : 'Novo registro clínico'}</h3>
          <label className="block text-sm">Tipo<select className={campo} value={tipo} disabled={ocupado} onChange={e => setTipo(e.target.value)}>{tipos.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></label>
          <label className="block text-sm">Registro<textarea required maxLength={30000} rows={7} className={campo} value={texto} disabled={ocupado} onChange={e => setTexto(e.target.value)} placeholder="Registre as informações clínicas pertinentes ao atendimento."/></label>
          <div className="flex flex-wrap gap-2"><button className={secundario} disabled={ocupado || !texto.trim()}>Salvar rascunho</button><button type="button" className={botao} disabled={ocupado || !texto.trim()} onClick={() => salvar(true)}>Finalizar registro</button>{edicao && <button type="button" className={secundario} onClick={() => {setEdicao(null);setTexto('');setTipo('EVOLUCAO')}}>Cancelar edição</button>}</div>
        </form>}
        <h3 className="font-semibold">Formulários de pré-consulta</h3>
        <p className="text-xs ux-secundario">Respostas autodeclaradas pelo portador do link. Revise clinicamente antes de utilizá-las.</p>
        {prontuario.formularios.map(f => <details key={f.id} className="rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">{f.link.modelo.titulo} (v{f.link.modelo.versao}) · {new Date(f.enviadaEm).toLocaleString('pt-BR')}</summary>
          <dl className="mt-3 space-y-3">{f.link.modelo.perguntas.map(p => <div key={p.id}><dt className="text-sm font-medium">{p.rotulo}</dt><dd className="whitespace-pre-wrap break-words text-sm ux-secundario">{f.respostas[p.id] === true ? 'Sim' : f.respostas[p.id] === false ? 'Não' : String(f.respostas[p.id] ?? 'Não respondida')}</dd></div>)}</dl>
        </details>)}
        {!prontuario.formularios.length && <p className="text-sm ux-secundario">Nenhum formulário respondido.</p>}
        <h3 className="font-semibold">Histórico clínico</h3>
        {prontuario.entradas.map(item => <article key={item.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2"><strong>{tipos.find(t => t[0] === item.tipo)?.[1]}</strong><Badge tone={item.situacao==="FINALIZADO"?"green":"amber"}>{item.situacao==="FINALIZADO"?"Finalizado":"Rascunho"}</Badge></div>
          <p className="mt-1 text-xs ux-secundario">{item.autorNome ?? 'Autor cadastrado'} {item.autorRegistro && ' · ' + item.autorRegistro} · {new Date(item.finalizadaEm ?? item.criadaEm).toLocaleString('pt-BR')}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.texto}</p>
          {item.situacao === 'RASCUNHO' && item.autorId === prontuario.usuarioId && prontuario.paciente.ativo && <button disabled={ocupado} className="mt-3 text-sm ux-link underline" onClick={() => {setEdicao(item);setTipo(item.tipo);setTexto(item.texto)}}>Editar rascunho</button>}
        </article>)}
        {!prontuario.entradas.length && <p className="text-sm ux-secundario">Nenhum registro clínico disponível.</p>}
      </>}
    </section>
  </div>
}
