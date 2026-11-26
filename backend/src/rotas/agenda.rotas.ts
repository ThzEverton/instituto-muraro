import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/agenda.controlador.js'

const perfis = ['ADMINISTRADOR', 'RECEPCAO'] as const

export async function registrarRotasAgenda(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/agenda/ausencias', { preHandler: exigirPerfis([...perfis]) }, controlador.listarAusencias)
  aplicacao.post('/api/v1/agenda/ausencias', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, controlador.criarAusencia)
  aplicacao.patch('/api/v1/agenda/ausencias/:id', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, controlador.inativarAusencia)
  aplicacao.get('/api/v1/salas', { preHandler: exigirPerfis([...perfis]) }, controlador.listarSalas)
  aplicacao.post('/api/v1/salas', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, controlador.criarSala)
  aplicacao.post('/api/v1/agendamentos/serie', { preHandler: exigirPerfis([...perfis]) }, controlador.criarSerieAgendamentos)
  aplicacao.get('/api/v1/agenda/disponibilidade', { preHandler: exigirPerfis([...perfis]) }, controlador.consultarDisponibilidadeAgenda)
  aplicacao.get('/api/v1/agenda/bloqueios', { preHandler: exigirPerfis([...perfis]) }, controlador.listarBloqueios)
  aplicacao.post('/api/v1/agenda/bloqueios', { preHandler: exigirPerfis([...perfis]) }, controlador.criarBloqueio)
  aplicacao.patch('/api/v1/agenda/bloqueios/:id', { preHandler: exigirPerfis([...perfis]) }, controlador.inativarBloqueio)
  aplicacao.get('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, controlador.listarAgendamentos)
  aplicacao.post('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, controlador.criarAgendamento)
  aplicacao.patch('/api/v1/agendamentos/:id', { preHandler: exigirPerfis([...perfis]) }, controlador.atualizarAgendamento)
}
