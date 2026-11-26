import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/painel.controlador.js'



export async function registrarRotasPainel(app:FastifyInstance){
  app.get('/api/v1/painel/resumo', {preHandler:exigirPerfis(['ADMINISTRADOR','RECEPCAO'])}, controlador.consultarResumo)
}
