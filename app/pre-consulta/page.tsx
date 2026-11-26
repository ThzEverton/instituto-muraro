'use client'
import { useEffect, useState, type FormEvent } from 'react'

type Pergunta = { id: string; rotulo: string; tipo: string; obrigatoria: boolean; opcoes?: string[] }
type Modelo = { titulo: string; versao: number; perguntas: Pergunta[] }
type Valor = string | number | boolean | null
async function api(acao: string, corpo: object) {
  const r = await fetch('/api/formulario-publico?acao=' + acao, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), cache: 'no-store' })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados.erro || 'Não foi possível concluir')
  return dados.dados
}
export default function PreConsulta() {
  const [token,setToken] = useState('')
  const [modelo,setModelo] = useState<Modelo | null>(null)
  const [respostas,setRespostas] = useState<Record<string,Valor>>({})
  const [erro,setErro] = useState('')
  const [carregando,setCarregando] = useState(true)
  const [enviado,setEnviado] = useState(false)
  useEffect(() => {
    const valor = window.location.hash.slice(1)
    if (!/^[a-f0-9]{64}$/.test(valor)) {setErro('Abra o link individual enviado pela clínica.');setCarregando(false);return}
    setToken(valor)
    api('consultar',{token:valor}).then(setModelo).catch(e => setErro(e.message)).finally(() => setCarregando(false))
  },[])
  async function enviar(e: FormEvent) {
    e.preventDefault();setErro('');setCarregando(true)
    try {await api('enviar',{token,respostas});setEnviado(true);setModelo(null);setRespostas({});setToken('');window.history.replaceState(null,'',window.location.pathname)}
    catch(e) {setErro(e instanceof Error ? e.message : 'Não foi possível enviar')}
    finally {setCarregando(false)}
  }
  const campo = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900'
  function alterar(id:string,valor:Valor) {setRespostas(a => ({...a,[id]:valor}))}
  return <main className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-slate-900"><div className="mx-auto max-w-xl space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-[#3c897d]">Instituto Muraro</p><h1 className="mt-2 text-3xl font-semibold">Pré-consulta</h1></header>
    {erro && <p role="alert" className="rounded-xl bg-white p-4 text-red-700">{erro}</p>}
    {carregando && <p role="status">Aguarde...</p>}
    {enviado && <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Respostas enviadas</h2><p className="mt-2 text-sm">A equipe clínica autorizada poderá consultar suas respostas.</p></section>}
    {modelo && <form onSubmit={enviar} className="space-y-6 rounded-2xl bg-white p-5 shadow-sm sm:p-7">
      <div><h2 className="text-xl font-semibold">{modelo.titulo}</h2><p className="mt-2 text-sm text-slate-600">Responda com atenção. Não compartilhe este link. Os campos marcados com * são obrigatórios.</p></div>
      {modelo.perguntas.map(p => <label key={p.id} className="block text-sm font-medium">{p.rotulo}{p.obrigatoria && ' *'}
        {p.tipo === 'TEXTO_LONGO' ? <textarea rows={4} className={campo} maxLength={10000} required={p.obrigatoria} value={String(respostas[p.id]??'')} onChange={e=>alterar(p.id,e.target.value)}/>
        : p.tipo === 'ESCOLHA' || p.tipo === 'SIM_NAO' ? <select className={campo} required={p.obrigatoria} value={String(respostas[p.id]??'')} onChange={e=>alterar(p.id,e.target.value===''?null:p.tipo==='SIM_NAO'?e.target.value==='true':e.target.value)}><option value="">Selecione</option>{p.tipo==='SIM_NAO'?<><option value="true">Sim</option><option value="false">Não</option></>:p.opcoes?.map(o=><option key={o} value={o}>{o}</option>)}</select>
        : <input className={campo} type={p.tipo==='NUMERO'?'number':p.tipo==='DATA'?'date':'text'} step={p.tipo==='NUMERO'?'any':undefined} maxLength={p.tipo==='TEXTO'?500:undefined} required={p.obrigatoria} value={String(respostas[p.id]??'')} onChange={e=>alterar(p.id,e.target.value===''?null:p.tipo==='NUMERO'?Number(e.target.value):e.target.value)}/>}
      </label>)}
      <button disabled={carregando} className="w-full rounded-xl bg-[#142b49] p-3 font-semibold text-white disabled:opacity-50">Enviar respostas</button>
    </form>}
  </div></main>
}
