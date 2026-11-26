import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/formularios.controlador.js'

const admin = exigirPerfis(['ADMINISTRADOR'])
const equipe = exigirPerfis(['ADMINISTRADOR', 'RECEPCAO'])

export async function registrarRotasFormularios(app: FastifyInstance) {
  app.get('/api/v1/formularios/modelos', { preHandler: equipe }, controlador.listarModelos)
  app.post('/api/v1/formularios/modelos', { preHandler: admin }, controlador.criarModelo)
  app.patch('/api/v1/formularios/modelos/:id', { preHandler: admin }, controlador.atualizarModelo)
  app.post('/api/v1/formularios/modelos/:id/publicar', { preHandler: admin }, controlador.publicarModelo)
  app.post('/api/v1/formularios/modelos/:id/versao', { preHandler: admin }, controlador.criarVersaoModelo)
  app.get('/api/v1/formularios/links', { preHandler: equipe }, controlador.listarLinks)
  app.post('/api/v1/formularios/links', { preHandler: equipe }, controlador.emitirLink)
  app.patch('/api/v1/formularios/links/:id', { preHandler: equipe }, controlador.revogarLink)
  app.post('/api/v1/formulario-publico/consultar', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, controlador.consultarFormularioPublico)
  app.post('/api/v1/formulario-publico/enviar', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, controlador.enviarFormularioPublico)
}
