import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'

export function registrarTratamentoErros(aplicacao: FastifyInstance) {
  aplicacao.setErrorHandler((erro, _requisicao, resposta) => {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      return resposta.code(409).send({ erro: 'Cadastro duplicado' })
    }
    if (typeof erro === 'object' && erro !== null && 'statusCode' in erro && erro.statusCode === 429) {
      return resposta.code(429).send({ erro: 'Limite de tentativas atingido' })
    }
    aplicacao.log.error({ codigo: 'ERRO_INTERNO' }, 'Falha na requisição')
    return resposta.code(500).send({ erro: 'Erro interno' })
  })
}
