import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { consultaAgenda, edicaoAgendamento, entradaAgendamento } from './agenda.validacao.js'
import { ConflitoAgenda, DadosAgendaInvalidos, verificarEGravarAgendamento } from './agenda.servico.js'

const perfis = ['ADMINISTRADOR', 'RECEPCAO'] as const

function erroAgenda(erro: unknown, resposta: { code: (status: number) => { send: (corpo: object) => unknown } }) {
  if (erro instanceof ConflitoAgenda) return resposta.code(409).send({ erro: erro.message })
  if (erro instanceof DadosAgendaInvalidos) return resposta.code(400).send({ erro: erro.message })
  throw erro
}

export async function registrarRotasAgenda(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const resultado = consultaAgenda.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Período inválido' })
    const { inicioEm, fimEm, profissionalId, servicoId } = resultado.data
    const dados = await prisma.agendamento.findMany({
      where: {
        inicioEm: { lt: new Date(fimEm) }, fimEm: { gt: new Date(inicioEm) },
        ...(profissionalId ? { profissionalId } : {}),
        ...(servicoId ? { servicoId } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      take: 1000,
    })
    return { dados }
  })

  aplicacao.post('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = entradaAgendamento.safeParse(requisicao.body)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Dados do agendamento inválidos' })
    try {
      const dados = resultado.data
      const agendamento = await verificarEGravarAgendamento({
        ...dados, inicioEm: new Date(dados.inicioEm), fimEm: new Date(dados.fimEm),
      }, requisicao.identidade!.id)
      return resposta.code(201).send({ dados: agendamento })
    } catch (erro) { return erroAgenda(erro, resposta) }
  })

  aplicacao.patch('/api/v1/agendamentos/:id', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const { id } = requisicao.params as { id: string }
    const resultado = edicaoAgendamento.safeParse(requisicao.body)
    if (!resultado.success || !Object.keys(resultado.data).length) return resposta.code(400).send({ erro: 'Alterações inválidas' })
    const existente = await prisma.agendamento.findUnique({ where: { id } })
    if (!existente) return resposta.code(404).send({ erro: 'Agendamento não encontrado' })
    if (['CANCELADO', 'CONCLUIDO', 'NAO_COMPARECEU'].includes(existente.situacao)) {
      return resposta.code(409).send({ erro: 'Agendamento encerrado não pode ser alterado' })
    }
    const { situacao, ...alteracoes } = resultado.data
    if (situacao && !Object.keys(alteracoes).length) {
      const agendamento = await prisma.$transaction(async (transacao) => {
        const alterado = await transacao.agendamento.update({ where: { id }, data: { situacao } })
        await transacao.registroAuditoria.create({
          data: { usuarioId: requisicao.identidade!.id, acao: 'ALTERAR_SITUACAO', entidade: 'agendamento', entidadeId: id },
        })
        return alterado
      })
      return { dados: agendamento }
    }
    const novos = {
      pacienteId: alteracoes.pacienteId ?? existente.pacienteId,
      profissionalId: alteracoes.profissionalId ?? existente.profissionalId,
      servicoId: alteracoes.servicoId ?? existente.servicoId,
      inicioEm: new Date(alteracoes.inicioEm ?? existente.inicioEm),
      fimEm: new Date(alteracoes.fimEm ?? existente.fimEm),
    }
    try {
      const agendamento = await verificarEGravarAgendamento(novos, requisicao.identidade!.id, id, situacao)
      return { dados: agendamento }
    } catch (erro) { return erroAgenda(erro, resposta) }
  })
}
