import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { modelo, edicao, publicacao, emissao, consultaPublica, envioPublico, validarRespostas, perguntas, consultaModelos, consultaLinks } from './formularios.validacao.js'

const admin = exigirPerfis(['ADMINISTRADOR'])
const equipe = exigirPerfis(['ADMINISTRADOR', 'RECEPCAO'])
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
class ErroFormulario extends Error { constructor(public status: number, mensagem: string) { super(mensagem) } }
function tratar(e: unknown, res: FastifyReply) {
  if (e instanceof ErroFormulario) return res.code(e.status).send({ erro: e.message })
  throw e
}
async function auditar(t: Prisma.TransactionClient, usuarioId: string, acao: string, entidade: string, entidadeId: string) {
  await t.registroAuditoria.create({ data: { usuarioId, acao, entidade, entidadeId } })
}
async function travar(t: Prisma.TransactionClient, chave: string) {
  await t.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('formulario'), hashtext(${chave}))::text`
}
async function verificarServico(t: Prisma.TransactionClient, servicoId: string | null) {
  if (servicoId && !(await t.servico.findUnique({ where: { id: servicoId } }))?.ativo) throw new ErroFormulario(400, 'Servico inexistente ou inativo')
}
const selecaoLink = {
  id: true, modeloId: true, agendamentoId: true, criadoEm: true, expiraEm: true, revogadoEm: true,
  modelo: { select: { titulo: true, versao: true } },
  respostas: { select: { id: true, enviadaEm: true } },
} as const
async function localizar(t: Prisma.TransactionClient, token: string) {
  const item = await t.linkFormulario.findUnique({ where: { tokenHash: hash(token) }, include: { modelo: true, agendamento: { include: { paciente: { select: { ativo: true } } } }, respostas: { select: { id: true } } } })
  if (!item || !item.pacienteId || item.revogadoEm || item.expiraEm <= new Date() || item.respostas.length ||
      item.modelo.situacao !== 'PUBLICADO' || !item.agendamento.paciente.ativo ||
      item.agendamento.pacienteId !== item.pacienteId || item.agendamento.profissionalId !== item.profissionalId || item.agendamento.servicoId !== item.servicoId ||
      ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'].includes(item.agendamento.situacao)) throw new ErroFormulario(410, 'Link indisponivel, expirado ou ja respondido')
  return item
}

export async function registrarRotasFormularios(app: FastifyInstance) {
  app.get('/api/v1/formularios/modelos', { preHandler: equipe }, async (req, res) => {
    const q = consultaModelos.safeParse(req.query)
    if (!q.success) return res.code(400).send({ erro: 'Consulta invalida' })
    if (q.data.publicados === 'false' && (req as RequisicaoAutenticada).identidade?.perfil !== 'ADMINISTRADOR') return res.code(403).send({ erro: 'Permissao insuficiente' })
    return { dados: await prisma.modeloFormulario.findMany({ where: q.data.publicados === 'true' ? { situacao: 'PUBLICADO' } : {}, orderBy: [{ titulo: 'asc' },{ versao: 'desc' }], take: 500 }) }
  })
  app.post('/api/v1/formularios/modelos', { preHandler: admin }, async (req: RequisicaoAutenticada, res) => {
    const v = modelo.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Modelo ou perguntas invalidas' })
    try {
      const dados = await prisma.$transaction(async t => {
        await verificarServico(t, v.data.servicoId)
        const item = await t.modeloFormulario.create({ data: { ...v.data, versao: 1 } })
        await auditar(t, req.identidade!.id, 'CRIAR_MODELO', 'modelo_formulario', item.id)
        return item
      })
      return res.code(201).send({ dados })
    } catch(e) { return tratar(e,res) }
  })
  app.patch('/api/v1/formularios/modelos/:id', { preHandler: admin }, async (req: RequisicaoAutenticada, res) => {
    const { id } = req.params as { id: string }
    const v = edicao.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Modelo invalido' })
    try {
      const dados = await prisma.$transaction(async t => {
        await travar(t,id)
        await verificarServico(t,v.data.servicoId)
        const { revisao,...campos } = v.data
        const alterado = await t.modeloFormulario.updateMany({ where: { id, situacao: 'RASCUNHO', revisao }, data: { ...campos, revisao: { increment: 1 } } })
        if (!alterado.count) throw new ErroFormulario(409, 'Modelo publicado ou revisao desatualizada')
        await auditar(t,req.identidade!.id,'EDITAR_MODELO','modelo_formulario',id)
        return t.modeloFormulario.findUniqueOrThrow({ where: { id } })
      })
      return { dados }
    } catch(e) { return tratar(e,res) }
  })
  app.post('/api/v1/formularios/modelos/:id/publicar', { preHandler: admin }, async (req: RequisicaoAutenticada,res) => {
    const { id } = req.params as { id: string }
    const v = publicacao.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Revisao invalida' })
    try {
      const dados = await prisma.$transaction(async t => {
        await travar(t,id)
        const item = await t.modeloFormulario.findUnique({ where: { id } })
        if (!item || item.situacao !== 'RASCUNHO' || item.revisao !== v.data.revisao || !perguntas.safeParse(item.perguntas).success) throw new ErroFormulario(409,'Modelo invalido ou desatualizado')
        await verificarServico(t,item.servicoId)
        const publicado = await t.modeloFormulario.update({ where: { id }, data: { situacao: 'PUBLICADO', publicadoEm: new Date() } })
        await auditar(t,req.identidade!.id,'PUBLICAR_MODELO','modelo_formulario',id)
        return publicado
      })
      return { dados }
    } catch(e) { return tratar(e,res) }
  })
  app.post('/api/v1/formularios/modelos/:id/versao', { preHandler: admin }, async (req: RequisicaoAutenticada,res) => {
    const { id } = req.params as { id: string }
    try {
      const dados = await prisma.$transaction(async t => {
        await travar(t,id)
        const item = await t.modeloFormulario.findUnique({ where: { id }, include: { proximaVersao: { select: { id: true } } } })
        if (!item || item.situacao !== 'PUBLICADO' || item.proximaVersao) throw new ErroFormulario(409,'Modelo nao permite nova versao')
        const lista = perguntas.parse(item.perguntas)
        const novo = await t.modeloFormulario.create({ data: { titulo: item.titulo, perguntas: lista, servicoId: item.servicoId, versao: item.versao + 1, modeloAnteriorId: id } })
        await auditar(t,req.identidade!.id,'CRIAR_VERSAO','modelo_formulario',novo.id)
        return novo
      })
      return res.code(201).send({ dados })
    } catch(e) { return tratar(e,res) }
  })
  app.get('/api/v1/formularios/links', { preHandler: equipe }, async (req,res) => {
    const q = consultaLinks.safeParse(req.query)
    if (!q.success) return res.code(400).send({ erro: 'Selecione um atendimento' })
    const atendimento = await prisma.agendamento.findUnique({ where: { id: q.data.agendamentoId }, select: { id: true, inicioEm: true, paciente: { select: { nomeCompleto: true } }, servico: { select: { id: true, nome: true } } } })
    if (!atendimento) return res.code(404).send({ erro: 'Atendimento inexistente' })
    return { atendimento, dados: await prisma.linkFormulario.findMany({ where: { agendamentoId: q.data.agendamentoId }, select: selecaoLink, orderBy: { criadoEm: 'desc' }, take: 100 }) }
  })
  app.post('/api/v1/formularios/links', { preHandler: equipe }, async (req: RequisicaoAutenticada,res) => {
    const v = emissao.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro: 'Dados do link invalidos' })
    try {
      const token = randomBytes(32).toString('hex')
      const dados = await prisma.$transaction(async t => {
        const { modeloId, agendamentoId, validadeHoras } = v.data
        await travar(t,agendamentoId + ':' + modeloId)
        const [m,a] = await Promise.all([t.modeloFormulario.findUnique({ where: { id: modeloId }, include: { proximaVersao: { select: { situacao: true } } } }),t.agendamento.findUnique({ where: { id: agendamentoId }, include: { paciente: { select: { ativo: true } } } })])
        if (!m || m.situacao !== 'PUBLICADO' || m.proximaVersao?.situacao === 'PUBLICADO' || !perguntas.safeParse(m.perguntas).success || !a?.paciente.ativo || ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'].includes(a.situacao) || (m.servicoId && m.servicoId !== a.servicoId)) throw new ErroFormulario(400,'Modelo ou atendimento indisponivel')
        const existentes = await t.linkFormulario.findMany({ where: { agendamentoId,modeloId,pacienteId:a.pacienteId,profissionalId:a.profissionalId,servicoId:a.servicoId }, select: { id: true, respostas: { select: { id: true } } }, orderBy: { id: 'asc' } })
        for (const anterior of existentes) await travar(t,anterior.id)
        if (await t.respostaFormulario.count({ where: { linkId: { in: existentes.map(e => e.id) } } })) throw new ErroFormulario(409,'Este modelo ja foi respondido para o atendimento')
        const revogados = await t.linkFormulario.findMany({ where: { id: { in: existentes.map(e => e.id) }, revogadoEm: null }, select: { id: true } })
        await t.linkFormulario.updateMany({ where: { id: { in: revogados.map(e => e.id) } }, data: { revogadoEm: new Date() } })
        for (const anterior of revogados) await auditar(t,req.identidade!.id,'REVOGAR_LINK','link_formulario',anterior.id)
        const item = await t.linkFormulario.create({ data: { modeloId,agendamentoId,pacienteId:a.pacienteId,profissionalId:a.profissionalId,servicoId:a.servicoId,tokenHash:hash(token),expiraEm:new Date(Date.now()+validadeHoras*3600000) }, select: selecaoLink })
        await auditar(t,req.identidade!.id,'EMITIR_LINK','link_formulario',item.id)
        return item
      })
      return res.code(201).send({ dados: { ...dados, token } })
    } catch(e) { return tratar(e,res) }
  })
  app.patch('/api/v1/formularios/links/:id', { preHandler: equipe }, async (req: RequisicaoAutenticada,res) => {
    const { id } = req.params as { id: string }
    try {
      const dados = await prisma.$transaction(async t => {
        await travar(t,id)
        const alterado = await t.linkFormulario.updateMany({ where: { id,revogadoEm:null,respostas:{none:{}} }, data: { revogadoEm:new Date() } })
        if (!alterado.count) throw new ErroFormulario(409,'Link inexistente, respondido ou revogado')
        await auditar(t,req.identidade!.id,'REVOGAR_LINK','link_formulario',id)
        return t.linkFormulario.findUniqueOrThrow({ where:{id},select:selecaoLink })
      })
      return { dados }
    } catch(e) { return tratar(e,res) }
  })
  app.post('/api/v1/formulario-publico/consultar', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req,res) => {
    const v = consultaPublica.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro:'Link invalido' })
    res.header('Cache-Control','no-store')
    try {
      const item = await prisma.$transaction(t => localizar(t,v.data.token))
      return { dados: { titulo:item.modelo.titulo, versao:item.modelo.versao, perguntas:item.modelo.perguntas } }
    } catch(e) { return tratar(e,res) }
  })
  app.post('/api/v1/formulario-publico/enviar', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (req,res) => {
    const v = envioPublico.safeParse(req.body)
    if (!v.success) return res.code(400).send({ erro:'Respostas invalidas' })
    res.header('Cache-Control','no-store')
    try {
      await prisma.$transaction(async t => {
        const inicial = await t.linkFormulario.findUnique({ where:{tokenHash:hash(v.data.token)},select:{id:true} })
        if (!inicial) throw new ErroFormulario(410,'Link indisponivel')
        await travar(t,inicial.id)
        const item = await localizar(t,v.data.token)
        // Lock the mutable appointment while checking its identity and inserting the response.
        await t.$queryRaw`SELECT id FROM agendamentos WHERE id = ${item.agendamentoId} FOR UPDATE`
        const conferido = await localizar(t,v.data.token)
        const respostas = validarRespostas(conferido.modelo.perguntas,v.data.respostas)
        if (!respostas) throw new ErroFormulario(400,'Confira os campos obrigatorios e os valores informados')
        await t.respostaFormulario.create({ data: { linkId:conferido.id,respostas } })
      })
      return res.code(201).send({ dados:{ enviado:true } })
    } catch(e) { return tratar(e,res) }
  })
}
