import type { FastifyInstance } from 'fastify'
import { consultar } from '../controladores/saude.controlador.js'

export async function registrarRotasSaude(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/saude', consultar)
}
