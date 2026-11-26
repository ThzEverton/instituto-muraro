'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

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

export default function Cadastros() {
  const [tipo, setTipo] = useState<Tipo>('profissionais')
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [formulario, setFormulario] = useState<Formulario>(vazio)
  const [edicaoId, setEdicaoId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
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
        duracaoMinutos: String(valor.duracaoMinutos), valorCentavos: String(valor.valorCentavos),
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
      valorCentavos: Number(formulario.valorCentavos),
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
    setErro('')
    try {
      await api(`${tipo}/${registro.id}`, { method: 'PATCH', body: JSON.stringify({ ativo: !registro.ativo }) })
      await carregar()
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Falha ao atualizar') }
  }

  const itens = (tipo === 'profissionais' ? profissionais : servicos).filter((item) =>
    item.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
  return <main className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-widest text-[#3c897d]">Instituto Muraro</p><h1 className="text-3xl font-semibold">Cadastros</h1></div>
        <Link href="/sistema" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Voltar aos pacientes</Link>
      </header>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-3">
          <button onClick={() => { setTipo('profissionais'); setBusca('') }} className={`rounded-lg px-4 py-2 ${tipo === 'profissionais' ? 'bg-[#142b49] text-white' : 'border border-slate-300'}`}>Profissionais</button>
          <button onClick={() => { setTipo('servicos'); setBusca('') }} className={`rounded-lg px-4 py-2 ${tipo === 'servicos' ? 'bg-[#142b49] text-white' : 'border border-slate-300'}`}>Serviços</button>
          <input aria-label="Buscar cadastro" className="ml-auto rounded-lg border border-slate-300 px-3 py-2" value={busca} placeholder="Buscar por nome" onChange={(evento) => setBusca(evento.target.value)} />
          <button onClick={novo} className="rounded-lg bg-[#142b49] px-4 py-2 text-white">Novo {tipo === 'profissionais' ? 'profissional' : 'serviço'}</button>
        </div>
        {erro && <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">Nome</th><th>Detalhe</th><th>Situação</th><th>Ações</th></tr></thead>
          <tbody>{itens.map((item) => <tr className="border-b" key={item.id}>
            <td className="py-3 font-medium">{item.nome}</td>
            <td>{tipo === 'profissionais' ? (item as Profissional).especialidade : `${(item as Servico).duracaoMinutos} min · R$ ${((item as Servico).valorCentavos / 100).toFixed(2)}`}</td>
            <td>{item.ativo ? 'Ativo' : 'Inativo'}</td>
            <td className="space-x-3 py-3"><button className="text-[#2b668f] underline" onClick={() => editar(item)}>Editar</button><button className="text-[#2b668f] underline" onClick={() => alternarAtivo(item)}>{item.ativo ? 'Inativar' : 'Ativar'}</button></td>
          </tr>)}</tbody></table>{!itens.length && <p className="py-6 text-center text-slate-500">Nenhum registro encontrado.</p>}</div>
      </section>
      {aberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={salvar} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-semibold">{edicaoId ? 'Editar' : 'Novo'} {tipo === 'profissionais' ? 'profissional' : 'serviço'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {campo('nome', 'Nome')}
          {tipo === 'profissionais' ? <>
            {campo('especialidade', 'Especialidade')}{campo('crefito', 'CREFITO')}{campo('telefone', 'Telefone', 'tel')}{campo('email', 'E-mail', 'email')}{campo('corAgenda', 'Cor da agenda', 'color')}
          </> : <>
            {campo('categoria', 'Categoria')}{campo('descricao', 'Descrição')}{campo('duracaoMinutos', 'Duração em minutos', 'number')}{campo('valorCentavos', 'Valor em centavos', 'number')}{campo('capacidade', 'Capacidade simultânea', 'number')}
          </>}
        </div>
        <fieldset className="mt-5"><legend className="mb-2 font-medium">{tipo === 'profissionais' ? 'Serviços habilitados' : 'Profissionais habilitados'}</legend>
          <div className="flex flex-wrap gap-3">{(tipo === 'profissionais' ? servicos : profissionais).filter((item) => item.ativo).map((item) =>
            <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formulario.vinculos.includes(item.id)} onChange={() => alternarVinculo(item.id)} />{item.nome}</label>)}</div>
        </fieldset>
        {tipo === 'profissionais' && <fieldset className="mt-5">
          <legend className="mb-2 font-medium">Expediente</legend>
          {formulario.expedientes.map((expediente, indice) => <div className="mb-2 flex flex-wrap items-center gap-2" key={indice}>
            <select aria-label="Dia da semana" className="rounded-lg border border-slate-300 p-2" value={expediente.diaSemana} onChange={(evento) => mudarExpediente(indice, 'diaSemana', Number(evento.target.value))}>{dias.map((dia, numero) => <option value={numero} key={dia}>{dia}</option>)}</select>
            <input aria-label="Início" type="time" value={horario(expediente.inicioMinuto)} onChange={(evento) => mudarExpediente(indice, 'inicioMinuto', minutos(evento.target.value))} className="rounded-lg border border-slate-300 p-2" />
            <input aria-label="Fim" type="time" value={horario(expediente.fimMinuto)} onChange={(evento) => mudarExpediente(indice, 'fimMinuto', minutos(evento.target.value))} className="rounded-lg border border-slate-300 p-2" />
            <button type="button" className="text-red-700 underline" onClick={() => setFormulario((atual) => ({ ...atual, expedientes: atual.expedientes.filter((_, posicao) => posicao !== indice) }))}>Remover</button>
          </div>)}
          <button type="button" className="text-[#2b668f] underline" onClick={() => setFormulario((atual) => ({ ...atual, expedientes: [...atual.expedientes, { diaSemana: 1, inicioMinuto: 480, fimMinuto: 1080 }] }))}>Adicionar horário</button>
        </fieldset>}
        {erro && <p role="alert" className="mt-4 text-sm text-red-700">{erro}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2">Cancelar</button><button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white disabled:opacity-50">Salvar</button></div>
      </form></div>}
    </div>
  </main>
}
