import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Prisma } from '@prisma/client'
import { prisma } from './infraestrutura/banco-de-dados/prisma.js'
import { registrarRotasAutenticacao } from './modulos/autenticacao/autenticacao.rotas.js'
import { registrarRotasPacientes } from './modulos/pacientes/pacientes.rotas.js'
import { registrarRotasProfissionais } from './modulos/profissionais/profissionais.rotas.js'
import { registrarRotasServicos } from './modulos/servicos/servicos.rotas.js'
import { registrarRotasAgenda } from './modulos/agenda/agenda.rotas.js'

import { registrarRotasProntuario } from './modulos/prontuario/prontuario.rotas.js'

import { registrarRotasFormularios } from './modulos/formularios/formularios.rotas.js'
import { registrarRotasFinanceiro } from './modulos/financeiro/financeiro.rotas.js'
import { etiquetas, esquemaDocumentacao, rotasDocumentadas } from './infraestrutura/documentacao/openapi.js'

export async function criarAplicacao() {
  const aplicacao = Fastify({ logger: { redact: ['req.headers.authorization', 'req.body.senha'] } })
  await aplicacao.register(cors, {
    origin: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : false,
  })
  await aplicacao.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await aplicacao.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Instituto Muraro API', version: '1.0.0', description: 'API operacional do Instituto Muraro. Dados dos exemplos são fictícios. Autentique-se pela rota de login e utilize o token no botão Authorize. Respeite os perfis autorizados. Não utilize dados reais em ambiente de desenvolvimento.' },
      tags: etiquetas,
      components: { securitySchemes: { BearerToken: { type: 'http', scheme: 'bearer', bearerFormat: 'Token opaco', description: 'Token de sessão retornado pelo login. Não é JWT. Válido por oito horas.' } } },
    },
    transform: ({ schema, url, route }) => {
      if (!url.startsWith('/api/v1/')) return { schema: { ...schema, hide: true }, url }
      const metodo = Array.isArray(route.method) ? route.method[0] : route.method
      if (metodo === 'HEAD') return { schema: { ...schema, hide: true }, url }
      return { schema: esquemaDocumentacao(metodo, url), url }
    },
  })
  // Exige documentação de cada nova operação, sem interferir na validação Zod ou serialização.
  aplicacao.addHook('onRoute', rota => {
    if (!rota.url.startsWith('/api/v1/')) return
    const metodos = Array.isArray(rota.method) ? rota.method : [rota.method]
    for (const metodo of metodos) {
      if (metodo !== 'HEAD' && !rotasDocumentadas.has(metodo + ' ' + rota.url)) throw new Error('Rota sem documentação OpenAPI: ' + metodo + ' ' + rota.url)
    }
  })
  // UI disponível por padrão localmente, desabilitada em produção salvo opção explícita.
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_HABILITADO === 'true') {
    await aplicacao.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'none', deepLinking: true, persistAuthorization: false } })
  }
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
  await registrarRotasProfissionais(aplicacao)
  await registrarRotasServicos(aplicacao)
  await registrarRotasAgenda(aplicacao)
  await registrarRotasProntuario(aplicacao)
  await registrarRotasFormularios(aplicacao)
  await registrarRotasFinanceiro(aplicacao)
  aplicacao.addHook('onClose', async () => prisma.$disconnect())
  return aplicacao
}

if (process.env.NODE_ENV !== 'test') {
  const aplicacao = await criarAplicacao()
  await aplicacao.listen({ port: Number(process.env.PORT ?? 3333), host: process.env.HOST ?? '127.0.0.1' })
}
