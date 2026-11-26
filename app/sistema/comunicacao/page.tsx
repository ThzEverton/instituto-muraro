'use client'
import {usePerfilSessao} from '@/lib/sessao-interface'
import { useEffect,useState,type FormEvent } from 'react'
import Link from 'next/link'
import {SectionHeader,Empty,Badge} from '@/components/physio/ui'

const tipos=[
  {id:'CONFIRMACAO_AGENDA',nome:'Confirmação de atendimento',dias:2,mensagem:'Olá, {nome}! Aqui é do {clinica}. Podemos confirmar seu compromisso de {data}, às {hora}?'},
  {id:'LEMBRETE_AGENDA',nome:'Lembrete de atendimento',dias:1,mensagem:'Olá, {nome}! Lembramos do seu compromisso de {data}, às {hora}, no {clinica}.'},
  {id:'COBRANCA',nome:'Lembrete de vencimento',dias:1,mensagem:'Olá, {nome}! Aqui é do {clinica}. Temos um lembrete administrativo para {data}. Entre em contato se precisar de ajuda.'},
  {id:'RENOVACAO',nome:'Lembrete de renovação',dias:7,mensagem:'Olá, {nome}! Aqui é do {clinica}. Podemos conversar sobre a renovação prevista para {data}?'},
]
type Regra={tipo:string;ativa:boolean;antecedenciaDias:number;mensagem:string}
type Item={id:string;tipo:string;paciente:{nomeCompleto:string};referenciaData:string;situacao:string;criadaEm:string;enviadaEm:string|null;canceladaEm:string|null}
type Preparada={telefone:string;mensagem:string}
const campo = 'm-input mt-1 w-full'
const botao = 'm-btn primary'
const secundario = 'm-btn secondary'
const falha=(e:unknown)=>e instanceof Error?e.message:'Falha na operação'
async function api<T>(rota:string,metodo='GET',corpo?:object):Promise<T>{
  const r=await fetch('/api/sistema/'+rota,{method:metodo,cache:'no-store',headers:{'Content-Type':'application/json'},...(corpo?{body:JSON.stringify(corpo)}:{})})
  const j=await r.json();if(!r.ok)throw new Error(j.erro||'Operação indisponível');return j
}
const formatar=(s:string)=>s.includes('T')?new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):s.split('-').reverse().join('/')
export default function Comunicacao(){
  const [aba,setAba]=useState('fila')
  const perfil=usePerfilSessao()
  const [regras,setRegras]=useState<Regra[]>([])
  const [fila,setFila]=useState<Item[]>([])
  const [situacao,setSituacao]=useState('PENDENTE')
  const [pagina,setPagina]=useState(1)
  const [total,setTotal]=useState(0)
  const [ocupado,setOcupado]=useState(false)
  const [erro,setErro]=useState('')
  const [aviso,setAviso]=useState('')
  const [preparada,setPreparada]=useState<{id:string;dados:Preparada}|null>(null)
  async function carregar(estado=situacao,p=pagina){
    const r=await api<{dados:Item[];total:number}>('comunicacao/fila?'+new URLSearchParams({situacao:estado,pagina:String(p)}))
    setFila(r.dados);setTotal(r.total);setPagina(p)
  }
  async function carregarRegras(){setRegras((await api<{dados:Regra[]}>('comunicacao/regras')).dados)}
  useEffect(()=>{
    if(perfil==='ADMINISTRADOR'||perfil==='RECEPCAO')carregar().catch(e=>setErro(falha(e)))
  },[])
  useEffect(()=>{if(aba==='regras'&&perfil==='ADMINISTRADOR')carregarRegras().catch(e=>setErro(falha(e)))},[aba,perfil])
  async function executar(fn:()=>Promise<unknown>,mensagem:string){
    setOcupado(true);setErro('');setAviso('')
    try{await fn();setAviso(mensagem);await carregar()}
    catch(e){setErro(falha(e))}
    finally{setOcupado(false)}
  }
  async function gerar(){
    setOcupado(true);setErro('');setAviso('')
    try{const r=await api<{dados:{criadas:number}}>('comunicacao/gerar','POST',{});setSituacao('PENDENTE');setPreparada(null);await carregar('PENDENTE',1);setAviso(r.dados.criadas+' pendência(s) nova(s) gerada(s). Nenhuma mensagem foi enviada.')}
    catch(e){setErro(falha(e))}
    finally{setOcupado(false)}
  }
  async function salvar(e:FormEvent<HTMLFormElement>,tipo:string){
    e.preventDefault();const f=new FormData(e.currentTarget)
    await executar(async()=>{await api('comunicacao/regras/'+tipo,'PATCH',{ativa:f.get('ativa')==='on',antecedenciaDias:Number(f.get('dias')),mensagem:String(f.get('mensagem'))});await carregarRegras()},'Regra salva.')
  }
  async function preparar(id:string){
    setOcupado(true);setErro('');setPreparada(null)
    try{const r=await api<{dados:Preparada}>('comunicacao/fila/'+id+'/preparar','POST',{});setPreparada({id,dados:r.dados})}
    catch(e){setErro(falha(e))}
    finally{setOcupado(false)}
  }
  return <div className="m-modulo space-y-5">
    <SectionHeader eyebrow="COMUNICAÇÃO" title="Comunicação" description="Regras e fila de mensagens para WhatsApp."/>
    {erro&&<p role="alert" className="rounded-lg bg-white p-3 text-red-700">{erro}</p>}{aviso&&<p role="status" className="rounded-lg bg-white p-3 text-green-800">{aviso}</p>}
    {perfil==='ADMINISTRADOR'&&<nav className="m-segmented m-subtabs" aria-label="Seções de comunicação"><button aria-pressed={aba==='fila'} className={aba==='fila'?'active':''} onClick={()=>{setAba('fila');setPreparada(null)}}>Fila de mensagens</button><button aria-pressed={aba==='regras'} className={aba==='regras'?'active':''} onClick={()=>{setAba('regras');setPreparada(null)}}>Regras e mensagens</button></nav>}
    {aba==='fila'&&['ADMINISTRADOR','RECEPCAO'].includes(perfil)&&<section className="space-y-4 m-card">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Fila de mensagens</h2><button className={botao} disabled={ocupado} onClick={gerar}>Gerar pendências</button></div>
      <p className="text-sm text-slate-600">Somente pacientes que autorizaram contato por WhatsApp. A geração é automática por regras, mas o envio é manual e deve ser confirmado pelo operador. Não há confirmação de entrega do WhatsApp.</p>
      <select aria-label="Situação da fila" className={campo} value={situacao} onChange={e=>{setSituacao(e.target.value);setPreparada(null);carregar(e.target.value,1).catch(e=>setErro(falha(e)))}}><option value="PENDENTE">Pendentes</option><option value="ENVIADA_MANUALMENTE">Envios registrados</option><option value="CANCELADA">Canceladas</option></select>
      {fila.map(m=><article key={m.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{tipos.find(t=>t.id===m.tipo)?.nome}</strong><p className="text-sm">{m.paciente.nomeCompleto} · {formatar(m.referenciaData)}</p></div>{m.situacao==='PENDENTE'&&<div className="flex gap-2"><button className={botao} disabled={ocupado} onClick={()=>preparar(m.id)}>Preparar</button><button className={secundario} disabled={ocupado} onClick={()=>{if(window.confirm('Cancelar esta pendência?'))void executar(async()=>{await api('comunicacao/fila/'+m.id+'/cancelar','PATCH',{});setPreparada(null)},'Pendência cancelada.')}}>Cancelar</button></div>}</div>
      {preparada?.id===m.id&&<div className="space-y-3 rounded-xl bg-slate-50 p-4"><p className="text-sm">Confira destinatário e mensagem antes de enviar: +{preparada.dados.telefone}</p><p className="whitespace-pre-wrap text-sm">{preparada.dados.mensagem}</p><div className="flex flex-wrap gap-2"><a href={'https://wa.me/'+preparada.dados.telefone+'?text='+encodeURIComponent(preparada.dados.mensagem)} target="_blank" rel="noopener noreferrer" className={botao}>Abrir WhatsApp</a><button className={secundario} disabled={ocupado} onClick={()=>{if(window.confirm('Você conferiu o destinatário e enviou manualmente esta mensagem?'))void executar(async()=>{await api('comunicacao/fila/'+m.id+'/enviada','PATCH',{});setPreparada(null)},'Envio manual registrado.')}}>Registrar envio manual</button><button className={secundario} onClick={()=>setPreparada(null)}>Fechar</button></div></div>}
      </article>)}
      {!fila.length&&<Empty title="Nenhuma mensagem nesta situação" description="Gere pendências ou altere o filtro para consultar outros registros."/>}
      <div className="flex gap-3"><button className={secundario} disabled={pagina<=1} onClick={()=>carregar(situacao,pagina-1).catch(e=>setErro(falha(e)))}>Anterior</button><button className={secundario} disabled={pagina*50>=total} onClick={()=>carregar(situacao,pagina+1).catch(e=>setErro(falha(e)))}>Próxima</button></div>
    </section>}
    {perfil==='ADMINISTRADOR'&&aba==='regras'&&<section className="space-y-4 m-card"><h2 className="text-xl font-semibold">Regras de comunicação</h2><p className="text-sm text-slate-600">Configure e habilite cada regra. Não inclua diagnósticos, prontuários, valores ou outras informações sensíveis nas mensagens. Variáveis: <code>{'{nome}, {data}, {hora}, {clinica}'}</code>.</p>
      {tipos.map(t=>{const r=regras.find(x=>x.tipo===t.id);return <form key={t.id+String(r?.ativa)+r?.mensagem} className="space-y-3 rounded-xl border p-4" onSubmit={e=>salvar(e,t.id)}><h3 className="font-semibold">{t.nome}</h3><label className="flex gap-2 text-sm"><input type="checkbox" name="ativa" defaultChecked={r?.ativa??false}/>Habilitar geração de pendências</label><label className="block text-sm">Antecedência em dias<input name="dias" type="number" min={0} max={30} required className={campo} defaultValue={r?.antecedenciaDias??t.dias}/></label><label className="block text-sm">Mensagem<textarea name="mensagem" rows={3} minLength={5} maxLength={600} required className={campo} defaultValue={r?.mensagem??t.mensagem}/></label><button className={botao} disabled={ocupado}>Salvar regra</button></form>})}
    </section>}
    {perfil==='FISIOTERAPEUTA'&&<p>Área reservada à equipe administrativa.</p>}
    {!perfil&&!erro&&<p>Verificando sessão...</p>}
  </div>
}
