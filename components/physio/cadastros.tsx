'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Edit3, Archive } from 'lucide-react'
import {SectionHeader, Badge, Table, SearchFilter, PillButton, ErrorNote, Dialog, Inputs, type FieldDef} from '@/components/physio/ui'
import {money} from '@/lib/physio-model'

type Tipo = 'profissionais' | 'servicos'
type Profissional = {
  id: string; nome: string; especialidade: string; crefito: string | null;
  telefone: string | null; email: string | null; corAgenda: string | null; ativo: boolean;
  servicos: { servicoId: string }[];
  expedientes: { diaSemana: number; inicioMinuto: number; fimMinuto: number }[];
}
type Servico = {
  id: string; nome: string; categoria: string | null; descricao: string | null;
  duracaoMinutos: number; valorCentavos: number; capacidade: number; ativo: boolean;
  profissionais: { profissionalId: string }[];
}
type Registro = Profissional | Servico
type Formulario = {
  nome: string; especialidade: string; crefito: string; telefone: string; email: string;
  corAgenda: string; categoria: string; descricao: string; duracaoMinutos: string;
  valorCentavos: string; capacidade: string; vinculos: string[];
  expedientes: { diaSemana: number; inicioMinuto: number; fimMinuto: number }[];
}
const vazio: Formulario = {
  nome: '', especialidade: '', crefito: '', telefone: '', email: '', corAgenda: '#2b668f',
  categoria: '', descricao: '', duracaoMinutos: '50', valorCentavos: '0', capacidade: '1',
  vinculos: [], expedientes: [],
}
const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

async function api<T>(rota: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api/sistema/${rota}`, {
    ...opcoes, headers: { 'Content-Type': 'application/json', ...opcoes?.headers }, cache: 'no-store',
  })
  const corpo = await resposta.json()
  if (!resposta.ok) throw new Error(corpo.erro || 'Falha na operação')
  return corpo
}

function horario(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}
function minutos(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export default function Cadastros({tipo}:{tipo:Tipo}) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [formulario, setFormulario] = useState<Formulario>(vazio)
  const [edicaoId, setEdicaoId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro,setFiltro]=useState('')
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async () => {
    const [resultadoProfissionais, resultadoServicos] = await Promise.all([
      api<{ dados: Profissional[] }>('profissionais?limite=100'),
      api<{ dados: Servico[] }>('servicos?limite=100'),
    ])
    setProfissionais(resultadoProfissionais.dados)
    setServicos(resultadoServicos.dados)
  }, [])
  useEffect(() => { carregar().catch((falha) => setErro(falha.message)) }, [carregar])

  function novo() { setFormulario(vazio); setEdicaoId(null); setAberto(true); setErro('') }
  function editar(registro: Registro) {
    if (tipo === 'profissionais') {
      const valor = registro as Profissional
      setFormulario({
        ...vazio, nome: valor.nome, especialidade: valor.especialidade,
        crefito: valor.crefito ?? '', telefone: valor.telefone ?? '', email: valor.email ?? '',
        corAgenda: valor.corAgenda ?? '#2b668f',
        vinculos: valor.servicos.map((v) => v.servicoId),
        expedientes: valor.expedientes.map(({ diaSemana, inicioMinuto, fimMinuto }) => ({ diaSemana, inicioMinuto, fimMinuto })),
      })
    } else {
      const valor = registro as Servico
      setFormulario({
        ...vazio, nome: valor.nome, categoria: valor.categoria ?? '', descricao: valor.descricao ?? '',
        duracaoMinutos: String(valor.duracaoMinutos), valorCentavos: String(valor.valorCentavos/100),
        capacidade: String(valor.capacidade),
        vinculos: valor.profissionais.map((v) => v.profissionalId),
      })
    }
    setEdicaoId(registro.id); setAberto(true); setErro('')
  }
  function campo(chave: keyof Formulario, rotulo: string, tipoCampo = 'text') {
    return <label className="flex flex-col gap-1 text-sm text-slate-700">{rotulo}<input
      className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
      type={tipoCampo} value={String(formulario[chave])}
      onChange={(evento) => setFormulario((atual) => ({ ...atual, [chave]: evento.target.value }))}
      required={chave === 'nome' || chave === 'especialidade'}
    /></label>
  }
  function alternarVinculo(id: string) {
    setFormulario((atual) => ({
      ...atual,
      vinculos: atual.vinculos.includes(id) ? atual.vinculos.filter((item) => item !== id) : [...atual.vinculos, id],
    }))
  }
  function mudarExpediente(indice: number, chave: 'diaSemana' | 'inicioMinuto' | 'fimMinuto', valor: number) {
    setFormulario((atual) => ({
      ...atual,
      expedientes: atual.expedientes.map((item, posicao) => posicao === indice ? { ...item, [chave]: valor } : item),
    }))
  }
  async function salvar(evento: FormEvent) {
    evento.preventDefault(); setCarregando(true); setErro('')
    const dados = tipo === 'profissionais' ? {
      nome: formulario.nome.trim(), especialidade: formulario.especialidade.trim(),
      crefito: formulario.crefito.trim() || (edicaoId ? null : undefined),
      telefone: formulario.telefone.trim() || (edicaoId ? null : undefined),
      email: formulario.email.trim() || (edicaoId ? null : undefined),
      corAgenda: formulario.corAgenda,
      servicosIds: formulario.vinculos,
      expedientes: formulario.expedientes,
    } : {
      nome: formulario.nome.trim(),
      categoria: formulario.categoria.trim() || (edicaoId ? null : undefined),
      descricao: formulario.descricao.trim() || (edicaoId ? null : undefined),
      duracaoMinutos: Number(formulario.duracaoMinutos),
      valorCentavos: Math.round(Number(formulario.valorCentavos)*100),
      capacidade: Number(formulario.capacidade),
      profissionaisIds: formulario.vinculos,
    }
    try {
      await api(edicaoId ? `${tipo}/${edicaoId}` : tipo, {
        method: edicaoId ? 'PATCH' : 'POST', body: JSON.stringify(dados),
      })
      setAberto(false); await carregar()
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao salvar') }
    finally { setCarregando(false) }
  }
  async function alternarAtivo(registro: Registro) {
    if(!window.confirm(registro.ativo?'Inativar este cadastro?':'Reativar este cadastro?'))return
    setErro('')
    try {
      await api(`${tipo}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !registro.ativo }) })
      await carregar()
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao atualizar') }
  }

  const itens = (tipo === 'profissionais' ? profissionais : servicos).filter(item=>item.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))&&(!filtro||(filtro==='Ativo'?item.ativo:!item.ativo)))
  const profissional=tipo==='profissionais'
  const campos:FieldDef[]=[{key:'nome',label:profissional?'Nome do fisioterapeuta':'Nome do serviço / procedimento',required:true,wide:true},...(profissional?[
    {key:'especialidade',label:'Área de atuação',required:true},{key:'crefito',label:'Registro CREFITO'},{key:'telefone',label:'Telefone',type:'tel' as const},{key:'email',label:'E-mail',type:'email' as const},{key:'corAgenda',label:'Cor no calendário',type:'select' as const,options:[{label:'Azul clínico',value:'#2b668f'},{label:'Verde petróleo',value:'#3c897d'},{label:'Areia',value:'#b88652'},{label:'Azul profundo',value:'#334b7b'}]},
  ]:[
    {key:'categoria',label:'Categoria'},{key:'duracaoMinutos',label:'Duração (minutos)',type:'number' as const,min:10,max:480,required:true},{key:'valorCentavos',label:'Valor (R$)',type:'number' as const,min:0,required:true},{key:'capacidade',label:'Capacidade simultânea',type:'number' as const,min:1,max:100,required:true},{key:'descricao',label:'Descrição',type:'textarea' as const,wide:true},
  ]),{key:'vinculos',label:profissional?'Serviços habilitados':'Fisioterapeutas habilitados',type:'multiselect',wide:true,options:(profissional?servicos:profissionais).filter(x=>x.ativo||formulario.vinculos.includes(x.id)).map(x=>({label:x.nome,value:x.id}))}]
  const acoes=(r:Registro)=><><PillButton title="Editar" onClick={()=>editar(r)}><Edit3 size={17}/></PillButton><PillButton title={r.ativo?'Inativar':'Reativar'} variant={r.ativo?'danger':'success'} onClick={()=>alternarAtivo(r)}><Archive size={17}/></PillButton></>
  return <>
    <SectionHeader eyebrow={profissional?'EQUIPE':'CATÁLOGO'} title={profissional?'Fisioterapeutas':'Serviços e procedimentos'} description={profissional?'Organize a equipe, especialidades, registros profissionais e disponibilidade.':'Defina procedimentos, preços, duração e profissionais habilitados.'} actions={<button className="m-btn primary" onClick={novo}><Plus size={17}/> Adicionar {profissional?'fisioterapeuta':'serviço'}</button>}/>
    <section className="m-card"><div className="m-module-intro"><div><h2>{profissional?'Equipe clínica':'Serviços oferecidos'}</h2><p>{itens.length} registros carregados</p></div></div><SearchFilter search={busca} setSearch={setBusca} filter={filtro} setFilter={setFiltro} options={[{label:'Todos os status',value:''},{label:'Ativos',value:'Ativo'},{label:'Inativos',value:'Inativo'}]}/>
      {erro&&!aberto&&<ErrorNote message={erro}/>}
      {profissional?<Table<Profissional> rows={itens as Profissional[]} columns={[
        {label:'Fisioterapeuta',cell:p=><div className="m-name-cell"><span className="m-avatar">{p.nome.split(' ').slice(0,2).map(v=>v[0]).join('').toUpperCase()}</span><span><strong>{p.nome}</strong><small>{p.email}</small></span></div>},
        {label:'CREFITO',cell:p=>p.crefito||'—'},{label:'Área de atuação',cell:p=>p.especialidade},{label:'Disponibilidade',cell:p=><div className="m-two-line"><strong>{p.expedientes.length?p.expedientes.map(e=>dias[e.diaSemana]+' '+horario(e.inicioMinuto)+'–'+horario(e.fimMinuto)).join(' • '):'Não cadastrada'}</strong></div>},{label:'Status',cell:p=><Badge tone={p.ativo?'green':'red'}>{p.ativo?'Ativo':'Inativo'}</Badge>}
      ]} actions={acoes}/>:<Table<Servico> rows={itens as Servico[]} columns={[
        {label:'Procedimento',cell:p=><div className="m-two-line"><strong>{p.nome}</strong><small>{p.descricao||'Sem descrição'}</small></div>},{label:'Categoria',cell:p=><Badge tone="blue">{p.categoria||'—'}</Badge>},{label:'Duração',cell:p=>p.duracaoMinutos+' min'},{label:'Valor',cell:p=>money(p.valorCentavos)},{label:'Habilitados',cell:p=>p.profissionais.length+' profissional(is)'},{label:'Capacidade',cell:p=>p.capacidade},{label:'Status',cell:p=><Badge tone={p.ativo?'green':'red'}>{p.ativo?'Ativo':'Inativo'}</Badge>}
      ]} actions={acoes}/>}
    </section>
    {aberto&&<Dialog title={(edicaoId?'Editar ':'Novo ')+(profissional?'fisioterapeuta':'serviço')} wide onClose={()=>setAberto(false)} footer={<><button className="m-btn secondary" onClick={()=>setAberto(false)}>Cancelar</button><button type="submit" form="form-cadastro" className="m-btn primary" disabled={carregando}>Salvar alterações</button></>}>
      <form id="form-cadastro" onSubmit={salvar}><Inputs fields={campos} form={formulario} onChange={(k,v)=>setFormulario(f=>({...f,[k]:v}))}/>
      {profissional&&<fieldset className="mt-5"><legend className="mb-2 font-medium">Expediente</legend>{formulario.expedientes.map((e,i)=><div key={i} className="m-form-grid mb-3"><label className="m-field"><span className="m-field-label">Dia da semana</span><select value={e.diaSemana} onChange={v=>mudarExpediente(i,'diaSemana',Number(v.target.value))}>{dias.map((d,n)=><option key={d} value={n}>{d}</option>)}</select></label><label className="m-field"><span className="m-field-label">Início</span><input type="time" required value={horario(e.inicioMinuto)} onChange={v=>mudarExpediente(i,'inicioMinuto',minutos(v.target.value))}/></label><label className="m-field"><span className="m-field-label">Fim</span><input type="time" required value={horario(e.fimMinuto)} onChange={v=>mudarExpediente(i,'fimMinuto',minutos(v.target.value))}/></label><button type="button" className="m-btn danger-outline" onClick={()=>setFormulario(f=>({...f,expedientes:f.expedientes.filter((_,n)=>n!==i)}))}>Remover</button></div>)}<button type="button" className="m-btn secondary" onClick={()=>setFormulario(f=>({...f,expedientes:[...f.expedientes,{diaSemana:1,inicioMinuto:480,fimMinuto:1080}]}))}><Plus size={16}/> Adicionar horário</button></fieldset>}
      {erro&&<ErrorNote message={erro}/>}</form>
    </Dialog>}
  </>
}
