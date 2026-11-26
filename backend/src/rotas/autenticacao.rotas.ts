import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/autenticacao.controlador.js'



export async function registrarRotasAutenticacao(aplicacao: FastifyInstance) {
  aplicacao.post('/api/v1/autenticacao/entrar', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, controlador.entrar)
  aplicacao.get('/api/v1/autenticacao/sessao', { preHandler: exigirPerfis(['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA']) }, controlador.consultarSessao)
  aplicacao.post('/api/v1/autenticacao/sair', {
    preHandler: exigirPerfis(['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA']),
  }, controlador.sair)
}
