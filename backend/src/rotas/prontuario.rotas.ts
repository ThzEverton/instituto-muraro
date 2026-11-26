import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/prontuario.controlador.js'

const administrador = exigirPerfis(['ADMINISTRADOR'])
const clinico = exigirPerfis(['FISIOTERAPEUTA'])

export async function registrarRotasProntuario(app: FastifyInstance) {
  app.get('/api/v1/clinica/contas', { preHandler: administrador }, controlador.listarContas)
  app.post('/api/v1/clinica/contas', { preHandler: administrador }, controlador.criarConta)
  app.post('/api/v1/clinica/associacoes', { preHandler: administrador }, controlador.associarConta)
  app.get('/api/v1/clinica/vinculos', { preHandler: administrador }, controlador.listarVinculos)
  app.post('/api/v1/clinica/vinculos', { preHandler: administrador }, controlador.salvarVinculo)
  app.get('/api/v1/clinica/pacientes', { preHandler: clinico }, controlador.listarPacientesClinicos)
  app.get('/api/v1/clinica/pacientes/:id/prontuario', { preHandler: clinico }, controlador.consultarProntuario)
  app.post('/api/v1/clinica/pacientes/:id/prontuario', { preHandler: clinico }, controlador.criarEntrada)
  app.patch('/api/v1/clinica/pacientes/:id/prontuario/:entradaId', { preHandler: clinico }, controlador.atualizarEntrada)
}
