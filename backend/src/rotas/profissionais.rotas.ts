import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/profissionais.controlador.js'

const perfis = ['ADMINISTRADOR', 'RECEPCAO'] as const

export async function registrarRotasProfissionais(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/profissionais', { preHandler: exigirPerfis([...perfis]) }, controlador.listarProfissionais)
  aplicacao.post('/api/v1/profissionais', { preHandler: exigirPerfis([...perfis]) }, controlador.criarProfissional)
  aplicacao.get('/api/v1/profissionais/:id', { preHandler: exigirPerfis([...perfis]) }, controlador.buscarProfissional)
  aplicacao.patch('/api/v1/profissionais/:id', { preHandler: exigirPerfis([...perfis]) }, controlador.atualizarProfissional)
}
