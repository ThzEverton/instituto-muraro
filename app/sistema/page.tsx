'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, LogOut, Plus, Search, UserRound } from 'lucide-react'
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
  const [autenticado, setAutenticado] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
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
    if (termo.trim()) parametros.set('busca', termo.trim())
    const resposta = await requisitar<{
      dados: Paciente[]
      paginacao: { totalPaginas: number }
    }>(`pacientes?${parametros}`)
    setPacientes(resposta.dados)
    setTotalPaginas(Math.max(1, resposta.paginacao.totalPaginas))
  }, [busca, pagina])

  useEffect(() => {
    requisitar<{ dados: { perfil: string } }>('autenticacao/sessao')
      .then(async (r) => {
        setPerfil(r.dados.perfil)
        if (r.dados.perfil === 'FISIOTERAPEUTA') { window.location.replace('/sistema/prontuario'); return }
        const resultado = await requisitar<{ dados: Paciente[]; paginacao: { totalPaginas: number } }>('pacientes?limite=20')
        setPacientes(resultado.dados)
        setTotalPaginas(Math.max(1, resultado.paginacao.totalPaginas))
        setAutenticado(true)
      })
      .catch(() => setAutenticado(false))
  }, [])

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const sessao = await requisitar<{ dados: { usuario: { perfil: string } } }>('autenticacao/entrar', {
        method: 'POST', body: JSON.stringify({ email, senha }),
      })
      setSenha('')
      setPerfil(sessao.dados.usuario.perfil)
      if (sessao.dados.usuario.perfil === 'FISIOTERAPEUTA') { window.location.replace('/sistema/prontuario'); return }
      await carregar('', 1)
      setAutenticado(true)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha no login')
    } finally {
      setCarregando(false)
    }
  }

  async function sair() {
    try {
      await requisitar('autenticacao/sair', { method: 'POST', body: '{}' })
    } finally {
      setAutenticado(false)
      setPacientes([])
      setFormulario(formularioVazio)
    }
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

  const campo = (chave: keyof Formulario, rotulo: string, tipo = 'text') => (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {rotulo}
      <input
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
        type={tipo}
        value={formulario[chave]}
        onChange={(evento) => setFormulario((atual) => ({ ...atual, [chave]: evento.target.value }))}
        required={chave === 'nomeCompleto'}
      />
    </label>
  )

  return (
    <main className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#3c897d]">Instituto Muraro</p>
            <h1 className="text-3xl font-semibold">Pacientes</h1>
          </div>
          <div className="flex gap-3">
            {autenticado && perfil === "ADMINISTRADOR" && <Link href="/sistema/prontuario" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Acessos clínicos</Link>}
            {autenticado && <Link href="/sistema/formularios" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Formulários</Link>}
            {autenticado && <Link href="/sistema/agenda" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Agenda</Link>}
            {autenticado && <Link href="/sistema/cadastros" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Profissionais e serviços</Link>}
            <Link href="/" className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm"><ArrowLeft size={16} /> Voltar</Link>
            {autenticado && <button onClick={sair} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm"><LogOut size={16} /> Sair</button>}
          </div>
        </header>

        {autenticado === null && <p>Verificando sessão...</p>}
        {autenticado === false && (
          <form onSubmit={entrar} className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3"><UserRound /><h2 className="text-xl font-semibold">Entrar no sistema</h2></div>
            <label className="block text-sm font-medium">E-mail<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" value={email} onChange={(evento) => setEmail(evento.target.value)} required /></label>
            <label className="block text-sm font-medium">Senha<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" value={senha} onChange={(evento) => setSenha(evento.target.value)} required /></label>
            {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
            <button disabled={carregando} className="w-full rounded-lg bg-[#142b49] px-4 py-2 font-medium text-white disabled:opacity-50">Entrar</button>
          </form>
        )}
        {autenticado && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <form onSubmit={(evento) => { evento.preventDefault(); setPagina(1); carregar(busca, 1).catch((falha) => setErro(falha.message)) }} className="flex gap-2">
                <input aria-label="Buscar paciente" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Buscar por nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
                <button className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2"><Search size={16} /> Buscar</button>
              </form>
              <button onClick={abrirNovo} className="flex items-center gap-2 rounded-lg bg-[#142b49] px-4 py-2 text-white"><Plus size={16} /> Novo paciente</button>
            </div>
            {erro && <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b text-slate-500"><th className="py-3">Nome</th><th>Telefone</th><th>Situação</th><th>Ações</th></tr></thead>
                <tbody>{pacientes.map((paciente) => (
                  <tr className="border-b" key={paciente.id}>
                    <td className="py-3 font-medium">{paciente.nomeCompleto}</td>
                    <td>{paciente.telefone || '—'}</td>
                    <td>{paciente.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="flex gap-2 py-3">
                      <button className="text-[#2b668f] underline" onClick={() => abrirEdicao(paciente)}>Editar</button>
                      <button className="text-[#2b668f] underline" onClick={() => alterarAtividade(paciente)}>{paciente.ativo ? 'Inativar' : 'Ativar'}</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {pacientes.length === 0 && <p className="py-6 text-center text-slate-500">Nenhum paciente encontrado.</p>}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3 text-sm">
              <button disabled={pagina <= 1} onClick={() => { setPagina(pagina - 1); carregar(busca, pagina - 1).catch((falha) => setErro(falha.message)) }} className="disabled:opacity-40">Anterior</button>
              <span>Página {pagina} de {totalPaginas}</span>
              <button disabled={pagina >= totalPaginas} onClick={() => { setPagina(pagina + 1); carregar(busca, pagina + 1).catch((falha) => setErro(falha.message)) }} className="disabled:opacity-40">Próxima</button>
            </div>
          </section>
        )}
        {mostrarFormulario && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <form onSubmit={salvar} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-5 text-xl font-semibold">{edicaoId ? 'Editar paciente' : 'Novo paciente'}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {campo('nomeCompleto', 'Nome completo')}
                {campo('cpf', 'CPF')}
                {campo('dataNascimento', 'Data de nascimento', 'date')}
                {campo('telefone', 'Telefone', 'tel')}
                {campo('whatsapp', 'WhatsApp', 'tel')}
                {campo('email', 'E-mail', 'email')}
                {campo('endereco', 'Endereço')}
                {campo('responsavelLegal', 'Responsável legal')}
                {campo('contatoEmergencia', 'Contato de emergência')}
                {campo('formaAtendimento', 'Forma de atendimento')}
                {campo('observacoesAdministrativas', 'Observações administrativas')}
              </div>
              {erro && <p role="alert" className="mt-4 text-sm text-red-700">{erro}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setMostrarFormulario(false)} className="rounded-lg border border-slate-300 px-4 py-2">Cancelar</button>
                <button disabled={carregando} className="rounded-lg bg-[#142b49] px-4 py-2 text-white disabled:opacity-50">Salvar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
