import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { consultaCadastros } from '../../compartilhado/validacoes/consulta-cadastros.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { cadastroProfissional, edicaoProfissional } from './profissionais.validacao.js'

const perfis = ['ADMINISTRADOR', 'RECEPCAO'] as const
const inclusao = {
  servicos: { select: { servicoId: true } },
  expedientes: { select: { id: true, diaSemana: true, inicioMinuto: true, fimMinuto: true } },
} as const

async function servicosValidos(ids: string[]) {
  if (!ids.length) return true
  return await prisma.servico.count({ where: { id: { in: ids }, ativo: true } }) === ids.length
}

export async function registrarRotasProfissionais(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/profissionais', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const resultado = consultaCadastros.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Filtros inválidos' })
    const { busca, ativo, pagina, limite } = resultado.data
    const filtro: Prisma.ProfissionalWhereInput = {
      ...(ativo ? { ativo: ativo === 'true' } : {}),
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    }
    const [totalRegistros, dados] = await prisma.$transaction([
      prisma.profissional.count({ where: filtro }),
      prisma.profissional.findMany({ where: filtro, include: inclusao, orderBy: { nome: 'asc' }, skip: (pagina - 1) * limite, take: limite }),
    ])
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
  })

  aplicacao.post('/api/v1/profissionais', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = cadastroProfissional.safeParse(requisicao.body)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Dados do profissional inválidos' })
    const { servicosIds, expedientes, ...dados } = resultado.data
    if (!await servicosValidos(servicosIds)) return resposta.code(400).send({ erro: 'Serviço inexistente ou inativo' })
    const profissional = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.profissional.create({
        data: {
          ...dados,
          servicos: { create: servicosIds.map((servicoId) => ({ servicoId })) },
          expedientes: { create: expedientes },
        },
        include: inclusao,
      })
      await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'profissional', entidadeId: criado.id } })
      return criado
    })
    return resposta.code(201).send({ dados: profissional })
  })

  aplicacao.get('/api/v1/profissionais/:id', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string }
    const profissional = await prisma.profissional.findUnique({ where: { id }, include: inclusao })
    return profissional ? { dados: profissional } : resposta.code(404).send({ erro: 'Profissional não encontrado' })
  })

  aplicacao.patch('/api/v1/profissionais/:id', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = edicaoProfissional.safeParse(requisicao.body)
    if (!resultado.success || !Object.keys(resultado.data).length) return resposta.code(400).send({ erro: 'Alterações inválidas' })
    const { id } = requisicao.params as { id: string }
    const existente = await prisma.profissional.findUnique({ where: { id }, select: { id: true } })
    if (!existente) return resposta.code(404).send({ erro: 'Profissional não encontrado' })
    const { servicosIds, expedientes, ...dados } = resultado.data
    if (servicosIds && !await servicosValidos(servicosIds)) return resposta.code(400).send({ erro: 'Serviço inexistente ou inativo' })
    const profissional = await prisma.$transaction(async (transacao) => {
      const alterado = await transacao.profissional.update({
        where: { id },
        data: {
          ...dados,
          ...(servicosIds ? { servicos: { deleteMany: {}, create: servicosIds.map((servicoId) => ({ servicoId })) } } : {}),
          ...(expedientes ? { expedientes: { deleteMany: {}, create: expedientes } } : {}),
        },
        include: inclusao,
      })
      await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'profissional', entidadeId: id } })
      return alterado
    })
    return { dados: profissional }
  })
}
