import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { consultaCadastros } from '../../compartilhado/validacoes/consulta-cadastros.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { cadastroServico, edicaoServico } from './servicos.validacao.js'

const consultaPerfis = ['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA'] as const
const edicaoPerfis = ['ADMINISTRADOR', 'RECEPCAO'] as const
const inclusao = { profissionais: { select: { profissionalId: true } } } as const

async function profissionaisValidos(ids: string[]) {
  if (!ids.length) return true
  return await prisma.profissional.count({ where: { id: { in: ids }, ativo: true } }) === ids.length
}

export async function registrarRotasServicos(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/servicos', { preHandler: exigirPerfis([...consultaPerfis]) }, async (requisicao, resposta) => {
    const resultado = consultaCadastros.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Filtros inválidos' })
    const { busca, ativo, pagina, limite } = resultado.data
    const filtro: Prisma.ServicoWhereInput = {
      ...(ativo ? { ativo: ativo === 'true' } : {}),
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    }
    const [totalRegistros, dados] = await prisma.$transaction([
      prisma.servico.count({ where: filtro }),
      prisma.servico.findMany({ where: filtro, include: inclusao, orderBy: { nome: 'asc' }, skip: (pagina - 1) * limite, take: limite }),
    ])
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
  })

  aplicacao.post('/api/v1/servicos', { preHandler: exigirPerfis([...edicaoPerfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = cadastroServico.safeParse(requisicao.body)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Dados do serviço inválidos' })
    const { profissionaisIds, ...dados } = resultado.data
    if (!await profissionaisValidos(profissionaisIds)) return resposta.code(400).send({ erro: 'Profissional inexistente ou inativo' })
    const servico = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.servico.create({
        data: { ...dados, profissionais: { create: profissionaisIds.map((profissionalId) => ({ profissionalId })) } },
        include: inclusao,
      })
      await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'servico', entidadeId: criado.id } })
      return criado
    })
    return resposta.code(201).send({ dados: servico })
  })

  aplicacao.get('/api/v1/servicos/:id', { preHandler: exigirPerfis([...consultaPerfis]) }, async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string }
    const servico = await prisma.servico.findUnique({ where: { id }, include: inclusao })
    return servico ? { dados: servico } : resposta.code(404).send({ erro: 'Serviço não encontrado' })
  })

  aplicacao.patch('/api/v1/servicos/:id', { preHandler: exigirPerfis([...edicaoPerfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = edicaoServico.safeParse(requisicao.body)
    if (!resultado.success || !Object.keys(resultado.data).length) return resposta.code(400).send({ erro: 'Alterações inválidas' })
    const { id } = requisicao.params as { id: string }
    const existente = await prisma.servico.findUnique({ where: { id }, select: { id: true } })
    if (!existente) return resposta.code(404).send({ erro: 'Serviço não encontrado' })
    const { profissionaisIds, ...dados } = resultado.data
    if (profissionaisIds && !await profissionaisValidos(profissionaisIds)) return resposta.code(400).send({ erro: 'Profissional inexistente ou inativo' })
    const servico = await prisma.$transaction(async (transacao) => {
      const alterado = await transacao.servico.update({
        where: { id },
        data: {
          ...dados,
          ...(profissionaisIds ? { profissionais: { deleteMany: {}, create: profissionaisIds.map((profissionalId) => ({ profissionalId })) } } : {}),
        },
        include: inclusao,
      })
      await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'servico', entidadeId: id } })
      return alterado
    })
    return { dados: servico }
  })
}
