import { travarProntuario } from '../repositorios/transacao.repositorio.js'
import { repositorioEntradaProntuario } from '../repositorios/entrada-prontuario.repositorio.js'
import { repositorioPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioProfissional } from '../repositorios/profissional.repositorio.js'
import { repositorioProntuario } from '../repositorios/prontuario.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioRespostaFormulario } from '../repositorios/resposta-formulario.repositorio.js'
import { repositorioUsuario } from '../repositorios/usuario.repositorio.js'
import { repositorioVinculoClinico } from '../repositorios/vinculo-clinico.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma } from '@prisma/client'
import { vinculo, conta, associacao, entrada, edicao, consultaVinculos, consultaPacientesClinicos } from '../validacoes/prontuario.validacao.js'
import { criarHashSenha } from '../utilitarios/senhas.js'

class ErroClinico extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem) }
}

function tratar(e: unknown) {
  if (e instanceof ErroClinico) return retornarResultado(e.status, { erro: e.message })
  throw e
}

async function auditoria(t: Prisma.TransactionClient, usuarioId: string, acao: string, entidade: string, entidadeId: string) {
  await repositorioRegistroAuditoria(t).criar({ data: { usuarioId, acao, entidade, entidadeId } })
}

async function travaPaciente(t: Prisma.TransactionClient, pacienteId: string) {
  await travarProntuario(t, pacienteId)
}

async function acesso(t: Prisma.TransactionClient, usuarioId: string, pacienteId: string) {
  const profissional = await repositorioProfissional(t).buscarPrimeiro({ where: {
    usuarioId, ativo: true, usuario: { ativo: true, perfil: 'FISIOTERAPEUTA' },
    vinculosClinicos: { some: { pacienteId, ativo: true } },
  }, select: { id: true, nome: true, crefito: true } })
  if (!profissional) throw new ErroClinico(403, 'Acesso clinico nao autorizado')
  return profissional
}

const camposEntrada = {
  id: true, autorId: true, autorNome: true, autorRegistro: true, tipo: true, texto: true,
  situacao: true, versao: true, criadaEm: true, finalizadaEm: true,
} as const

export async function listarContas() {
    const dados = await repositorioUsuario().listar({ where: { perfil: 'FISIOTERAPEUTA', ativo: true },
      select: { id: true, nome: true, email: true, profissional: { select: { id: true } } }, orderBy: { nome: 'asc' }, take: 500 })
    return { dados }
}

export async function criarConta(req: EntradaOperacao) {
    const v = conta.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Informe profissional, e-mail e senha de pelo menos 12 caracteres' })
    try {
      const senhaHash = await criarHashSenha(v.data.senha)
      const dados = await emTransacao(async t => {
        const profissional = await repositorioProfissional(t).buscarUnico({ where: { id: v.data.profissionalId } })
        if (!profissional?.ativo || profissional.usuarioId) throw new ErroClinico(409, 'Profissional indisponivel ou ja possui conta')
        const usuario = await repositorioUsuario(t).criar({ data: { nome: profissional.nome, email: v.data.email.toLowerCase(), senhaHash, perfil: 'FISIOTERAPEUTA' }, select: { id: true, nome: true, email: true } })
        const alterado = await repositorioProfissional(t).atualizarVarios({ where: { id: profissional.id, usuarioId: null, ativo: true }, data: { usuarioId: usuario.id } })
        if (!alterado.count) throw new ErroClinico(409, 'Profissional ja possui conta')
        await auditoria(t, req.identidade!.id, 'CRIAR_CONTA_CLINICA', 'profissional', profissional.id)
        return usuario
      })
      return retornarResultado(201, { dados })
    } catch (e) { return tratar(e) }
}

export async function associarConta(req: EntradaOperacao) {
    const v = associacao.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Dados invalidos' })
    try {
      const dados = await emTransacao(async t => {
        const u = await repositorioUsuario(t).buscarUnico({ where: { id: v.data.usuarioId } })
        if (!u?.ativo || u.perfil !== 'FISIOTERAPEUTA') throw new ErroClinico(400, 'Conta clinica invalida')
        const alterado = await repositorioProfissional(t).atualizarVarios({ where: { id: v.data.profissionalId, ativo: true, usuarioId: null }, data: { usuarioId: u.id } })
        if (!alterado.count) throw new ErroClinico(409, 'Profissional indisponivel ou ja possui conta')
        await auditoria(t, req.identidade!.id, 'ASSOCIAR_CONTA_CLINICA', 'profissional', v.data.profissionalId)
        return { profissionalId: v.data.profissionalId, usuarioId: u.id }
      })
      return retornarResultado(201, { dados })
    } catch(e) { return tratar(e) }
}

export async function listarVinculos(req: EntradaOperacao) {
    const v = consultaVinculos.safeParse(req.consulta)
    if (!v.success) return retornarResultado(400, { erro: 'Selecione o profissional' })
    return { dados: await repositorioVinculoClinico().listar({ where: { profissionalId: v.data.profissionalId },
      select: { id: true, pacienteId: true, ativo: true, paciente: { select: { nomeCompleto: true } } }, orderBy: { paciente: { nomeCompleto: 'asc' } } }) }
}

export async function salvarVinculo(req: EntradaOperacao) {
    const v = vinculo.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Vinculo invalido' })
    try {
      const dados = await emTransacao(async t => {
        await travaPaciente(t, v.data.pacienteId)
        const [p, f] = await Promise.all([repositorioPaciente(t).buscarUnico({ where: { id: v.data.pacienteId } }), repositorioProfissional(t).buscarUnico({ where: { id: v.data.profissionalId } })])
        if (!p || !f || (v.data.ativo && (!p.ativo || !f.ativo))) throw new ErroClinico(400, 'Paciente ou profissional indisponivel')
        const item = await repositorioVinculoClinico(t).criarOuAtualizar({ where: { pacienteId_profissionalId: { pacienteId: p.id, profissionalId: f.id } },
          create: v.data, update: { ativo: v.data.ativo } })
        await auditoria(t, req.identidade!.id, v.data.ativo ? 'CONCEDER_ACESSO' : 'REVOGAR_ACESSO', 'vinculo_clinico', item.id)
        return item
      })
      return { dados }
    } catch(e) { return tratar(e) }
}

export async function listarPacientesClinicos(req: EntradaOperacao) {
    const v = consultaPacientesClinicos.safeParse(req.consulta)
    if (!v.success) return retornarResultado(400, { erro: 'Consulta invalida' })
    const where: Prisma.PacienteWhereInput = {
      vinculosClinicos: { some: { ativo: true, profissional: { usuarioId: req.identidade!.id, ativo: true } } },
      ...(v.data.busca ? { nomeCompleto: { contains: v.data.busca, mode: 'insensitive' } } : {}),
    }
    const [total, dados] = await emTransacao([
      repositorioPaciente().contar({ where }),
      repositorioPaciente().listar({ where, select: { id: true, nomeCompleto: true, ativo: true }, orderBy: { nomeCompleto: 'asc' }, skip: (v.data.pagina - 1) * 50, take: 50 }),
    ])
    return { dados, total }
}

export async function consultarProntuario(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    try {
      const dados = await emTransacao(async t => {
        await travaPaciente(t, id)
        await acesso(t, req.identidade!.id, id)
        const paciente = await repositorioPaciente(t).buscarUnicoOuFalhar({ where: { id }, select: { id: true, nomeCompleto: true, ativo: true } })
        const entradas = await repositorioEntradaProntuario(t).listar({ where: { prontuario: { pacienteId: id },
          OR: [{ situacao: 'FINALIZADO' }, { autorId: req.identidade!.id }] }, select: camposEntrada, orderBy: { criadaEm: 'desc' } })
        await auditoria(t, req.identidade!.id, 'CONSULTAR_PRONTUARIO', 'paciente', id)
        const formularios = await repositorioRespostaFormulario(t).listar({ where: { link: { pacienteId: id } },
          select: { id: true, respostas: true, enviadaEm: true, link: { select: { agendamentoId: true, modelo: { select: { titulo: true, versao: true, perguntas: true } } } } }, orderBy: { enviadaEm: 'desc' } })
        return { paciente, entradas, formularios, usuarioId: req.identidade!.id }
      })
      return { dados }
    } catch(e) { return tratar(e) }
}

export async function criarEntrada(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    const v = entrada.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Registro clinico invalido' })
    try {
      const dados = await emTransacao(async t => {
        await travaPaciente(t, id)
        const f = await acesso(t, req.identidade!.id, id)
        if (!(await repositorioPaciente(t).buscarUnico({ where: { id } }))?.ativo) throw new ErroClinico(409, 'Paciente inativo')
        const prontuario = await repositorioProntuario(t).buscarPrimeiro({ where: { pacienteId: id }, orderBy: { criadoEm: 'asc' } }) ?? await repositorioProntuario(t).criar({ data: { pacienteId: id } })
        const item = await repositorioEntradaProntuario(t).criar({ data: { ...v.data, prontuarioId: prontuario.id, autorId: req.identidade!.id, autorNome: f.nome, autorRegistro: f.crefito }, select: camposEntrada })
        await auditoria(t, req.identidade!.id, 'CRIAR_RASCUNHO', 'entrada_prontuario', item.id)
        return item
      })
      return retornarResultado(201, { dados })
    } catch(e) { return tratar(e) }
}

export async function atualizarEntrada(req: EntradaOperacao) {
    const { id, entradaId } = req.parametros as { id: string; entradaId: string }
    const v = edicao.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Registro clinico invalido' })
    try {
      const dados = await emTransacao(async t => {
        await travaPaciente(t, id)
        await acesso(t, req.identidade!.id, id)
        if (!(await repositorioPaciente(t).buscarUnico({ where: { id } }))?.ativo) throw new ErroClinico(409, 'Paciente inativo')
        const existente = await repositorioEntradaProntuario(t).buscarPrimeiro({ where: { id: entradaId, prontuario: { pacienteId: id }, autorId: req.identidade!.id } })
        if (!existente) throw new ErroClinico(404, 'Registro nao encontrado')
        if (existente.situacao === 'FINALIZADO') throw new ErroClinico(409, 'Registro finalizado e imutavel; utilize um adendo')
        const alterado = await repositorioEntradaProntuario(t).atualizarVarios({ where: { id: entradaId, situacao: 'RASCUNHO', versao: v.data.versao },
          data: { tipo: v.data.tipo, texto: v.data.texto, versao: { increment: 1 }, ...(v.data.finalizar ? { situacao: 'FINALIZADO', finalizadaEm: new Date() } : {}) } })
        if (!alterado.count) throw new ErroClinico(409, 'Versao desatualizada; recarregue o registro')
        await auditoria(t, req.identidade!.id, v.data.finalizar ? 'FINALIZAR_REGISTRO' : 'EDITAR_RASCUNHO', 'entrada_prontuario', entradaId)
        return repositorioEntradaProntuario(t).buscarUnicoOuFalhar({ where: { id: entradaId }, select: camposEntrada })
      })
      return { dados }
    } catch(e) { return tratar(e) }
}
