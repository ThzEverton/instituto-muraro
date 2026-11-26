import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/pacientes.controlador.js'

const perfisAdministrativos = ['ADMINISTRADOR', 'RECEPCAO'] as const

export async function registrarRotasPacientes(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/pacientes', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, controlador.listarPacientes)
  aplicacao.post('/api/v1/pacientes', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, controlador.criarPaciente)
  aplicacao.get('/api/v1/pacientes/:id', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, controlador.buscarPaciente)
  aplicacao.patch('/api/v1/pacientes/:id', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, controlador.atualizarPaciente)
}
