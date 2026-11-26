'use client'
import {usePerfilSessao} from '@/lib/sessao-interface'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {ClipboardList,CalendarDays,Plus,Edit3,Copy,Send} from 'lucide-react'
import {SectionHeader,SearchFilter,Empty,Badge,Dialog,Table,PillButton,ErrorNote} from '@/components/physio/ui'

type Pergunta = { id: string; rotulo: string; tipo: string; obrigatoria: boolean; opcoes?: string[] }
type Modelo = { id: string; titulo: string; versao: number; revisao: number; situacao: string; servicoId: string | null; perguntas: Pergunta[]; modeloAnteriorId?: string | null }
type Servico = { id: string; nome: string }
type LinkEmitido = { id: string; expiraEm: string; revogadoEm: string | null; modelo: { titulo: string; versao: number }; respostas: { id: string; enviadaEm: string }[] }
type Atendimento = { id: string; paciente: { nomeCompleto: string }; servico: { id: string; nome: string }; inicioEm: string }
const tipos = [['TEXTO','Texto curto'],['TEXTO_LONGO','Texto longo'],['NUMERO','Número'],['ESCOLHA','Uma alternativa'],['SIM_NAO','Sim ou não'],['DATA','Data']]
const campo = 'm-input mt-1 w-full'
const botao = 'm-btn primary'
const secundario = 'm-btn secondary'
const perguntaNova = (): Pergunta => ({ id: crypto.randomUUID(), rotulo: '', tipo: 'TEXTO_LONGO', obrigatoria: true })
async function api<T>(rota: string, metodo = 'GET', corpo?: object): Promise<T> {
  const r = await fetch('/api/sistema/' + rota,{method:metodo,headers:{'Content-Type':'application/json'},cache:'no-store',...(corpo?{body:JSON.stringify(corpo)}:{})})
  const json = await r.json()
  if (!r.ok) throw new Error(json.erro || 'Falha na operação')
  return json
}
const mensagem = (e:unknown) => e instanceof Error ? e.message : 'Falha na operação'
export default function Formularios() {
  const perfil=usePerfilSessao()
  const [agendamentoId,setAgendamentoId] = useState('')
  const [buscaModelo,setBuscaModelo]=useState('')
  const [filtroModelo,setFiltroModelo]=useState('')
  const [modelos,setModelos] = useState<Modelo[]>([])
  const [servicos,setServicos] = useState<Servico[]>([])
  const [atendimento,setAtendimento] = useState<Atendimento|null>(null)
  const [links,setLinks] = useState<LinkEmitido[]>([])
  const [modeloId,setModeloId] = useState('')
  const [validade,setValidade] = useState(48)
  const [url,setUrl] = useState('')
  const [erro,setErro] = useState('')
  const [aviso,setAviso] = useState('')
  const [ocupado,setOcupado] = useState(false)
  const [editando,setEditando] = useState<Modelo|null>(null)
  const [aberto,setAberto] = useState(false)
  const [titulo,setTitulo] = useState('')
  const [servicoId,setServicoId] = useState('')
  const [perguntas,setPerguntas] = useState<Pergunta[]>([])
  async function carregar(p:string) {
    const [m,s] = await Promise.all([api<{dados:Modelo[]}>('formularios/modelos?publicados='+ (p==='ADMINISTRADOR'?'false':'true')),api<{dados:Servico[]}>('servicos?ativo=true&limite=100')])
    setModelos(m.dados);setServicos(s.dados)
  }
  async function carregarLinks(id:string) {
    if (!id) return
    const r = await api<{dados:LinkEmitido[];atendimento:Atendimento}>('formularios/links?'+new URLSearchParams({agendamentoId:id}))
    setLinks(r.dados);setAtendimento(r.atendimento)
  }
  useEffect(()=>{
    const id = new URLSearchParams(window.location.search).get('agendamento') || ''
    setAgendamentoId(id)
    if (perfil==='ADMINISTRADOR'||perfil==='RECEPCAO') carregar(perfil).then(()=>carregarLinks(id)).catch(e=>setErro(mensagem(e)))
  },[])
  function editar(m:Modelo|null) {
    setEditando(m);setTitulo(m?.titulo??'');setServicoId(m?.servicoId??'');setPerguntas(m?.perguntas??[perguntaNova()]);setAberto(true);setErro('');setAviso('')
  }
  function atualizar(id:string,campos:Partial<Pergunta>) {setPerguntas(p=>p.map(q=>q.id===id?{...q,...campos}:q))}
  async function executar(acao:()=>Promise<unknown>,sucesso:string) {
    setOcupado(true);setErro('');setAviso('')
    try {await acao();await carregar(perfil);await carregarLinks(agendamentoId);setAviso(sucesso)}
    catch(e){setErro(mensagem(e))}
    finally{setOcupado(false)}
  }
  async function salvar(e:FormEvent) {
    e.preventDefault()
    const dados = { titulo,servicoId:servicoId||null,perguntas:perguntas.map(p=>({id:p.id,rotulo:p.rotulo,tipo:p.tipo,obrigatoria:p.obrigatoria,...(p.tipo==='ESCOLHA'?{opcoes:p.opcoes??[]}: {})})) }
    await executar(async()=>{await api(editando?'formularios/modelos/'+editando.id:'formularios/modelos',editando?'PATCH':'POST',editando?{...dados,revisao:editando.revisao}:dados);setAberto(false)},'Rascunho salvo.')
  }
  async function emitir(e:FormEvent) {
    e.preventDefault();setUrl('')
    await executar(async()=>{
      const r=await api<{dados:LinkEmitido&{token:string}}>('formularios/links','POST',{modeloId,agendamentoId,validadeHoras:validade})
      setUrl(window.location.origin+'/pre-consulta#'+r.dados.token)
    },'Link individual gerado. Copie antes de sair desta tela.')
  }
  const publicados=modelos.filter(m=>m.situacao==='PUBLICADO'&&(!m.servicoId||m.servicoId===atendimento?.servico.id)&&!modelos.some(n=>n.modeloAnteriorId===m.id&&n.situacao==='PUBLICADO'))
  const modelosVisiveis=modelos.filter(m=>(!filtroModelo||m.situacao===filtroModelo)&&m.titulo.toLocaleLowerCase("pt-BR").includes(buscaModelo.toLocaleLowerCase("pt-BR")))
  return <div className="m-modulo space-y-5">
    <SectionHeader eyebrow="FORMULÁRIOS" title="Formulários e pré-consulta" description="Gerencie questionários e links de atendimento." actions={perfil==="ADMINISTRADOR"?<button className={botao} onClick={()=>editar(null)}><Plus size={17}/> Novo modelo</button>:undefined}/>
    {erro&&<p role="alert" className="rounded-lg bg-white p-3 text-red-700">{erro}</p>}{aviso&&<p role="status" className="rounded-lg bg-white p-3 text-green-800">{aviso}</p>}
    {(perfil==='ADMINISTRADOR'||perfil==='RECEPCAO')&&<section className="space-y-4 m-card">
      <div className="m-card-head"><div><h2>Pré-consulta de um atendimento</h2><p>Questionários individuais vinculados à agenda.</p></div><CalendarDays size={22}/></div>
      {!atendimento?<div className="m-info-row"><ClipboardList size={20}/><span>Selecione um atendimento na agenda para emitir um link individual.</span><Link href="/sistema/agenda" className={secundario}>Abrir agenda</Link></div>:<>
        <p className="text-sm"><strong>{atendimento.paciente.nomeCompleto}</strong> · {atendimento.servico.nome} · {new Date(atendimento.inicioEm).toLocaleString('pt-BR')}</p>
        <form onSubmit={emitir} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <label className="block text-sm">Modelo publicado<select required value={modeloId} onChange={e=>setModeloId(e.target.value)} className={campo}><option value="">Selecione</option>{publicados.map(m=><option key={m.id} value={m.id}>{m.titulo} (v{m.versao})</option>)}</select></label>
          <label className="block text-sm">Validade (horas)<input required type="number" min={1} max={168} value={validade} onChange={e=>setValidade(Number(e.target.value))} className={campo}/></label>
          <button className={botao} disabled={ocupado||!modeloId}>Gerar link</button>
        </form>
        {url&&<div className="space-y-2 rounded-xl border p-3"><p className="text-sm">Link confidencial, de uso único:</p><input readOnly value={url} className={campo}/><button className={secundario} onClick={async()=>{try{await navigator.clipboard.writeText(url);setAviso('Link copiado.')}catch{setAviso('Selecione e copie o link manualmente.')}}}>Copiar link</button></div>}
        <div className="divide-y">{links.map(l=>{const estado=l.respostas.length?'Respondido':l.revogadoEm?'Revogado':new Date(l.expiraEm)<=new Date()?'Expirado':'Pendente';return <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><strong>{l.modelo.titulo} · v{l.modelo.versao}</strong><p>{estado} · validade até {new Date(l.expiraEm).toLocaleString('pt-BR')}</p></div>{estado==='Pendente'&&<button className={secundario} disabled={ocupado} onClick={()=>{if(window.confirm('Revogar este link?'))void executar(()=>api('formularios/links/'+l.id,'PATCH',{}),'Link revogado.')}}>Revogar</button>}</div>})}</div>
      </>}
    </section>}
    {perfil==='ADMINISTRADOR'&&<section className="space-y-4 m-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Modelos e versões</h2></div>
      <p className="text-sm text-slate-600">Cadastre apenas perguntas validadas pela clínica. Modelos publicados não podem ser alterados: crie uma nova versão.</p>
      <SearchFilter search={buscaModelo} setSearch={setBuscaModelo} filter={filtroModelo} setFilter={setFiltroModelo} options={[{label:"Todos os status",value:""},{label:"Publicados",value:"PUBLICADO"},{label:"Rascunhos",value:"RASCUNHO"}]} placeholder="Buscar modelo de formulário"/><Table<Modelo> rows={modelosVisiveis} columns={[
{label:'Modelo',cell:m=><div className="m-name-cell"><span className="m-avatar"><ClipboardList size={18}/></span><div className="m-two-line"><strong>{m.titulo}</strong><small>{servicos.find(s=>s.id===m.servicoId)?.nome??'Geral'}</small></div></div>},
{label:'Versão',cell:m=>'v'+m.versao},{label:'Perguntas',cell:m=>m.perguntas.length},{label:'Situação',cell:m=><Badge tone={m.situacao==='PUBLICADO'?'green':'amber'}>{m.situacao==='PUBLICADO'?'Publicado':'Rascunho'}</Badge>}
]} actions={m=>m.situacao==='RASCUNHO'?<><PillButton title="Editar modelo" onClick={()=>editar(m)} disabled={ocupado}><Edit3 size={17}/></PillButton><button className="m-btn secondary m-fin-small" disabled={ocupado} onClick={()=>{if(window.confirm('Publicar esta versão imutável?'))void executar(()=>api('formularios/modelos/'+m.id+'/publicar','POST',{revisao:m.revisao}),'Modelo publicado.')}}>Publicar</button></>:!modelos.some(n=>n.modeloAnteriorId===m.id)&&<button className="m-btn secondary m-fin-small" disabled={ocupado} onClick={()=>executar(()=>api('formularios/modelos/'+m.id+'/versao','POST',{}),'Nova versão criada como rascunho.')}>Nova versão</button>}/>

    </section>}
    {aberto&&<Dialog title={editando?'Editar modelo':'Novo modelo'} subtitle="Configure o questionário e salve o rascunho antes de publicar." wide onClose={()=>{if(!ocupado)setAberto(false)}} footer={<><button className={secundario} onClick={()=>setAberto(false)} disabled={ocupado}>Cancelar</button><button form="modelo-form" type="submit" className={botao} disabled={ocupado}>Salvar rascunho</button></>}><form id="modelo-form" onSubmit={salvar} className="space-y-4">
      <label className="block text-sm">Título<input required minLength={2} maxLength={180} value={titulo} onChange={e=>setTitulo(e.target.value)} className={campo}/></label>
      <label className="block text-sm">Procedimento<select className={campo} value={servicoId} onChange={e=>setServicoId(e.target.value)}><option value="">Todos os procedimentos</option>{servicos.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
      {perguntas.map((p,i)=><div key={p.id} className="m-form-question space-y-3"><div className="flex justify-between"><strong>Pergunta {i+1}</strong><div className="flex gap-2"><button type="button" className="m-btn secondary m-fin-small" aria-label="Mover pergunta para cima" disabled={i===0} onClick={()=>setPerguntas(a=>{const b=[...a];[b[i-1],b[i]]=[b[i],b[i-1]];return b})}>↑</button><button type="button" className="m-btn secondary m-fin-small" aria-label="Mover pergunta para baixo" disabled={i===perguntas.length-1} onClick={()=>setPerguntas(a=>{const b=[...a];[b[i+1],b[i]]=[b[i],b[i+1]];return b})}>↓</button><button type="button" disabled={perguntas.length===1} className="text-red-700" onClick={()=>setPerguntas(a=>a.filter(q=>q.id!==p.id))}>Remover</button></div></div>
        <label className="block text-sm">Pergunta<input required maxLength={300} className={campo} value={p.rotulo} onChange={e=>atualizar(p.id,{rotulo:e.target.value})}/></label>
        <label className="block text-sm">Tipo<select className={campo} value={p.tipo} onChange={e=>atualizar(p.id,{tipo:e.target.value,opcoes:e.target.value==='ESCOLHA'?['','']:undefined})}>{tipos.map(t=><option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></label>
        {p.tipo==='ESCOLHA'&&<div className="space-y-2"><p className="text-sm">Alternativas</p>{(p.opcoes??[]).map((o,j)=><div className="flex gap-2" key={j}><input required maxLength={150} className={campo} value={o} onChange={e=>atualizar(p.id,{opcoes:p.opcoes?.map((v,k)=>k===j?e.target.value:v)})}/><button type="button" disabled={(p.opcoes?.length??0)<=2} onClick={()=>atualizar(p.id,{opcoes:p.opcoes?.filter((_,k)=>k!==j)})}>Remover</button></div>)}<button type="button" className={secundario} disabled={(p.opcoes?.length??0)>=30} onClick={()=>atualizar(p.id,{opcoes:[...(p.opcoes??[]),'']})}>Adicionar opção</button></div>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={p.obrigatoria} onChange={e=>atualizar(p.id,{obrigatoria:e.target.checked})}/>Obrigatória</label>
      </div>)}
      <button type="button" className={secundario} disabled={perguntas.length>=60} onClick={()=>setPerguntas(a=>[...a,perguntaNova()])}><Plus size={16}/> Adicionar pergunta</button>{erro&&<ErrorNote message={erro}/>}</form></Dialog>}
    {perfil==='FISIOTERAPEUTA'&&<Link href="/sistema/prontuario" className={secundario}>Consultar respostas no prontuário</Link>}
  </div>
}
