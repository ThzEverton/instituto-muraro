import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Prisma } from '@prisma/client'
import { prisma } from './infraestrutura/banco-de-dados/prisma.js'
import { registrarRotasAutenticacao } from './modulos/autenticacao/autenticacao.rotas.js'
import { registrarRotasPacientes } from './modulos/pacientes/pacientes.rotas.js'

export async function criarAplicacao() {
  const aplicacao = Fastify({ logger: { redact: ['req.headers.authorization', 'req.body.senha'] } })
  await aplicacao.register(cors, {
    origin: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : false,
  })
  await aplicacao.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await aplicacao.register(swagger, { openapi: { info: { title: 'Instituto Muraro API', version: '1.0.0' } } })
  await aplicacao.register(swaggerUi, { routePrefix: '/docs' })
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
  aplicacao.get('/api/v1/saude', async (_requisicao, resposta) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { situacao: 'operacional' }
    } catch {
      return resposta.code(503).send({ situacao: 'banco indisponível' })
    }
  })
  await registrarRotasAutenticacao(aplicacao)
  await registrarRotasPacientes(aplicacao)
  aplicacao.addHook('onClose', async () => prisma.$disconnect())
  return aplicacao
}

if (process.env.NODE_ENV !== 'test') {
  const aplicacao = await criarAplicacao()
  await aplicacao.listen({ port: Number(process.env.PORT ?? 3333), host: process.env.HOST ?? '127.0.0.1' })
}
