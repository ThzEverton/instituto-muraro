import type { FastifyInstance, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { criarHashSenha } from '../../compartilhado/seguranca/senhas.js'

const administrador = exigirPerfis(['ADMINISTRADOR'])
const clinico = exigirPerfis(['FISIOTERAPEUTA'])
const identificador = z.string().min(1).max(100)
const vinculo = z.object({ pacienteId: identificador, profissionalId: identificador, ativo: z.boolean() }).strict()
const conta = z.object({ profissionalId: identificador, email: z.email().max(254), senha: z.string().min(12).max(128) }).strict()
const associacao = z.object({ profissionalId: identificador, usuarioId: identificador }).strict()
const tipos = z.enum(['ANAMNESE', 'AVALIACAO', 'EVOLUCAO', 'ADENDO'])
const entrada = z.object({ tipo: tipos, texto: z.string().trim().min(1).max(30000) }).strict()
const edicao = entrada.extend({ versao: z.number().int().positive(), finalizar: z.boolean().default(false) }).strict()
class ErroClinico extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem) }
}
function tratar(e: unknown, resposta: FastifyReply) {
  if (e instanceof ErroClinico) return resposta.code(e.status).send({ erro: e.message })
  throw e
}
async function auditoria(t: Prisma.TransactionClient, usuarioId: string, acao: string, entidade: string, entidadeId: string) {
  await t.registroAuditoria.create({ data: { usuarioId, acao, entidade, entidadeId } })
}
async function travaPaciente(t: Prisma.TransactionClient, pacienteId: string) {
  await t.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('prontuario'), hashtext(${pacienteId}))::text`
}
async function acesso(t: Prisma.TransactionClient, usuarioId: string, pacienteId: string) {
  const profissional = await t.profissional.findFirst({ where: {
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

export async function registrarRotasProntuario(app: FastifyInstance) {
  app.get('/api/v1/clinica/contas', { preHandler: administrador }, async () => {
    const dados = await prisma.usuario.findMany({ where: { perfil: 'FISIOTERAPEUTA', ativo: true },
      select: { id: true, nome: true, email: true, profissional: { select: { id: true } } }, orderBy: { nome: 'asc' }, take: 500 })
    return { dados }
  })
  app.post('/api/v1/clinica/contas', { preHandler: administrador }, async (req: RequisicaoAutenticada, res) => {
    const v = conta.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Informe profissional, e-mail e senha de pelo menos 12 caracteres' })
    try {
      const senhaHash = await criarHashSenha(v.data.senha)
      const dados = await prisma.$transaction(async t => {
        const profissional = await t.profissional.findUnique({ where: { id: v.data.profissionalId } })
        if (!profissional?.ativo || profissional.usuarioId) throw new ErroClinico(409, 'Profissional indisponivel ou ja possui conta')
        const usuario = await t.usuario.create({ data: { nome: profissional.nome, email: v.data.email.toLowerCase(), senhaHash, perfil: 'FISIOTERAPEUTA' }, select: { id: true, nome: true, email: true } })
        const alterado = await t.profissional.updateMany({ where: { id: profissional.id, usuarioId: null, ativo: true }, data: { usuarioId: usuario.id } })
        if (!alterado.count) throw new ErroClinico(409, 'Profissional ja possui conta')
        await auditoria(t, req.identidade!.id, 'CRIAR_CONTA_CLINICA', 'profissional', profissional.id)
        return usuario
      })
      return res.code(201).send({ dados })
    } catch (e) { return tratar(e, res) }
  })
  app.post('/api/v1/clinica/associacoes', { preHandler: administrador }, async (req: RequisicaoAutenticada, res) => {
    const v = associacao.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Dados invalidos' })
    try {
      const dados = await prisma.$transaction(async t => {
        const u = await t.usuario.findUnique({ where: { id: v.data.usuarioId } })
        if (!u?.ativo || u.perfil !== 'FISIOTERAPEUTA') throw new ErroClinico(400, 'Conta clinica invalida')
        const alterado = await t.profissional.updateMany({ where: { id: v.data.profissionalId, ativo: true, usuarioId: null }, data: { usuarioId: u.id } })
        if (!alterado.count) throw new ErroClinico(409, 'Profissional indisponivel ou ja possui conta')
        await auditoria(t, req.identidade!.id, 'ASSOCIAR_CONTA_CLINICA', 'profissional', v.data.profissionalId)
        return { profissionalId: v.data.profissionalId, usuarioId: u.id }
      })
      return res.code(201).send({ dados })
    } catch(e) { return tratar(e, res) }
  })
  app.get('/api/v1/clinica/vinculos', { preHandler: administrador }, async (req, res) => {
    const v = z.object({ profissionalId: identificador }).safeParse(req.query)
    if (!v.success) return res.code(400).send({ erro: 'Selecione o profissional' })
    return { dados: await prisma.vinculoClinico.findMany({ where: { profissionalId: v.data.profissionalId },
      select: { id: true, pacienteId: true, ativo: true, paciente: { select: { nomeCompleto: true } } }, orderBy: { paciente: { nomeCompleto: 'asc' } } }) }
  })
  app.post('/api/v1/clinica/vinculos', { preHandler: administrador }, async (req: RequisicaoAutenticada, res) => {
    const v = vinculo.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Vinculo invalido' })
    try {
      const dados = await prisma.$transaction(async t => {
        await travaPaciente(t, v.data.pacienteId)
        const [p, f] = await Promise.all([t.paciente.findUnique({ where: { id: v.data.pacienteId } }), t.profissional.findUnique({ where: { id: v.data.profissionalId } })])
        if (!p || !f || (v.data.ativo && (!p.ativo || !f.ativo))) throw new ErroClinico(400, 'Paciente ou profissional indisponivel')
        const item = await t.vinculoClinico.upsert({ where: { pacienteId_profissionalId: { pacienteId: p.id, profissionalId: f.id } },
          create: v.data, update: { ativo: v.data.ativo } })
        await auditoria(t, req.identidade!.id, v.data.ativo ? 'CONCEDER_ACESSO' : 'REVOGAR_ACESSO', 'vinculo_clinico', item.id)
        return item
      })
      return { dados }
    } catch(e) { return tratar(e, res) }
  })
  app.get('/api/v1/clinica/pacientes', { preHandler: clinico }, async (req: RequisicaoAutenticada, res) => {
    const v = z.object({ busca: z.string().max(150).optional(), pagina: z.coerce.number().int().min(1).max(10000).default(1) }).safeParse(req.query)
    if (!v.success) return res.code(400).send({ erro: 'Consulta invalida' })
    const where: Prisma.PacienteWhereInput = {
      vinculosClinicos: { some: { ativo: true, profissional: { usuarioId: req.identidade!.id, ativo: true } } },
      ...(v.data.busca ? { nomeCompleto: { contains: v.data.busca, mode: 'insensitive' } } : {}),
    }
    const [total, dados] = await prisma.$transaction([
      prisma.paciente.count({ where }),
      prisma.paciente.findMany({ where, select: { id: true, nomeCompleto: true, ativo: true }, orderBy: { nomeCompleto: 'asc' }, skip: (v.data.pagina - 1) * 50, take: 50 }),
    ])
    return { dados, total }
  })
  app.get('/api/v1/clinica/pacientes/:id/prontuario', { preHandler: clinico }, async (req: RequisicaoAutenticada, res) => {
    const { id } = req.params as { id: string }
    try {
      const dados = await prisma.$transaction(async t => {
        await travaPaciente(t, id)
        await acesso(t, req.identidade!.id, id)
        const paciente = await t.paciente.findUniqueOrThrow({ where: { id }, select: { id: true, nomeCompleto: true, ativo: true } })
        const entradas = await t.entradaProntuario.findMany({ where: { prontuario: { pacienteId: id },
          OR: [{ situacao: 'FINALIZADO' }, { autorId: req.identidade!.id }] }, select: camposEntrada, orderBy: { criadaEm: 'desc' } })
        await auditoria(t, req.identidade!.id, 'CONSULTAR_PRONTUARIO', 'paciente', id)
        return { paciente, entradas, usuarioId: req.identidade!.id }
      })
      return { dados }
    } catch(e) { return tratar(e, res) }
  })
  app.post('/api/v1/clinica/pacientes/:id/prontuario', { preHandler: clinico }, async (req: RequisicaoAutenticada, res) => {
    const { id } = req.params as { id: string }
    const v = entrada.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Registro clinico invalido' })
    try {
      const dados = await prisma.$transaction(async t => {
        await travaPaciente(t, id)
        const f = await acesso(t, req.identidade!.id, id)
        if (!(await t.paciente.findUnique({ where: { id } }))?.ativo) throw new ErroClinico(409, 'Paciente inativo')
        const prontuario = await t.prontuario.findFirst({ where: { pacienteId: id }, orderBy: { criadoEm: 'asc' } }) ?? await t.prontuario.create({ data: { pacienteId: id } })
        const item = await t.entradaProntuario.create({ data: { ...v.data, prontuarioId: prontuario.id, autorId: req.identidade!.id, autorNome: f.nome, autorRegistro: f.crefito }, select: camposEntrada })
        await auditoria(t, req.identidade!.id, 'CRIAR_RASCUNHO', 'entrada_prontuario', item.id)
        return item
      })
      return res.code(201).send({ dados })
    } catch(e) { return tratar(e, res) }
  })
  app.patch('/api/v1/clinica/pacientes/:id/prontuario/:entradaId', { preHandler: clinico }, async (req: RequisicaoAutenticada, res) => {
    const { id, entradaId } = req.params as { id: string; entradaId: string }
    const v = edicao.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Registro clinico invalido' })
    try {
      const dados = await prisma.$transaction(async t => {
        await travaPaciente(t, id)
        await acesso(t, req.identidade!.id, id)
        if (!(await t.paciente.findUnique({ where: { id } }))?.ativo) throw new ErroClinico(409, 'Paciente inativo')
        const existente = await t.entradaProntuario.findFirst({ where: { id: entradaId, prontuario: { pacienteId: id }, autorId: req.identidade!.id } })
        if (!existente) throw new ErroClinico(404, 'Registro nao encontrado')
        if (existente.situacao === 'FINALIZADO') throw new ErroClinico(409, 'Registro finalizado e imutavel; utilize um adendo')
        const alterado = await t.entradaProntuario.updateMany({ where: { id: entradaId, situacao: 'RASCUNHO', versao: v.data.versao },
          data: { tipo: v.data.tipo, texto: v.data.texto, versao: { increment: 1 }, ...(v.data.finalizar ? { situacao: 'FINALIZADO', finalizadaEm: new Date() } : {}) } })
        if (!alterado.count) throw new ErroClinico(409, 'Versao desatualizada; recarregue o registro')
        await auditoria(t, req.identidade!.id, v.data.finalizar ? 'FINALIZAR_REGISTRO' : 'EDITAR_RASCUNHO', 'entrada_prontuario', entradaId)
        return t.entradaProntuario.findUniqueOrThrow({ where: { id: entradaId }, select: camposEntrada })
      })
      return { dados }
    } catch(e) { return tratar(e, res) }
  })
}
