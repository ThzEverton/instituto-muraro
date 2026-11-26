import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/servicos.controlador.js'

const consultaPerfis = ['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA'] as const
const edicaoPerfis = ['ADMINISTRADOR', 'RECEPCAO'] as const

export async function registrarRotasServicos(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/servicos', { preHandler: exigirPerfis([...consultaPerfis]) }, controlador.listarServicos)
  aplicacao.post('/api/v1/servicos', { preHandler: exigirPerfis([...edicaoPerfis]) }, controlador.criarServico)
  aplicacao.get('/api/v1/servicos/:id', { preHandler: exigirPerfis([...consultaPerfis]) }, controlador.buscarServico)
  aplicacao.patch('/api/v1/servicos/:id', { preHandler: exigirPerfis([...edicaoPerfis]) }, controlador.atualizarServico)
}
