import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/comunicacao.controlador.js'

const equipe=exigirPerfis(['ADMINISTRADOR','RECEPCAO'])
const admin=exigirPerfis(['ADMINISTRADOR'])

export async function registrarRotasComunicacao(app:FastifyInstance){
  app.get('/api/v1/comunicacao/regras', {preHandler:admin}, controlador.listarRegras)
  app.patch('/api/v1/comunicacao/regras/:tipo', {preHandler:admin}, controlador.atualizarRegra)
  app.patch('/api/v1/comunicacao/pacientes/:id/autorizacao', {preHandler:equipe}, controlador.atualizarAutorizacaoWhatsApp)
  app.post('/api/v1/comunicacao/gerar', {preHandler:equipe}, controlador.gerarPendencias)
  app.get('/api/v1/comunicacao/fila', {preHandler:equipe}, controlador.listarFila)
  app.post('/api/v1/comunicacao/fila/:id/preparar', {preHandler:equipe}, controlador.prepararEnvio)
  app.patch('/api/v1/comunicacao/fila/:id/enviada', {preHandler:equipe}, controlador.registrarEnvio)
  app.patch('/api/v1/comunicacao/fila/:id/cancelar', {preHandler:equipe}, controlador.cancelarMensagem)
}
