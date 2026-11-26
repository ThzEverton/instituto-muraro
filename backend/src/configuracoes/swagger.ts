import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { etiquetas, esquemaDocumentacao, rotasDocumentadas } from './openapi.js'
import { guiaApi, temaSwagger, marcaSwagger } from './tema-swagger.js'

export async function configurarSwagger(aplicacao: FastifyInstance) {
  await aplicacao.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Instituto Muraro — API operacional', version: '1.0.0', description: guiaApi },
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
    await aplicacao.register(swaggerUi, {
      routePrefix: '/docs', theme: temaSwagger, logo: marcaSwagger, validatorUrl: false,
      uiConfig: { docExpansion: 'none', deepLinking: true, persistAuthorization: false, filter: true, displayRequestDuration: true, defaultModelExpandDepth: 1, defaultModelsExpandDepth: -1, defaultModelRendering: 'example', syntaxHighlight: { activate: true, theme: 'agate' } },
    })
  }
}
