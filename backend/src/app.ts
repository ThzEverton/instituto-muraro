import { configurarSwagger } from './configuracoes/swagger.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { registrarTratamentoErros } from './middlewares/erros.middleware.js'
import { registrarRotasSaude } from './rotas/saude.rotas.js'
import { prisma } from './configuracoes/banco-de-dados.js'
import { registrarRotasAutenticacao } from './rotas/autenticacao.rotas.js'
import { registrarRotasPacientes } from './rotas/pacientes.rotas.js'
import { registrarRotasProfissionais } from './rotas/profissionais.rotas.js'
import { registrarRotasServicos } from './rotas/servicos.rotas.js'
import { registrarRotasAgenda } from './rotas/agenda.rotas.js'

import { registrarRotasProntuario } from './rotas/prontuario.rotas.js'

import { registrarRotasFormularios } from './rotas/formularios.rotas.js'
import { registrarRotasPainel } from './rotas/painel.rotas.js'
import { registrarRotasComunicacao } from './rotas/comunicacao.rotas.js'
import { registrarRotasFinanceiro } from './rotas/financeiro.rotas.js'

export async function criarAplicacao() {
  const aplicacao = Fastify({ logger: { redact: ['req.headers.authorization', 'req.body.senha'] } })
  await aplicacao.register(cors, {
    origin: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : false,
  })
  await aplicacao.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await configurarSwagger(aplicacao)
  registrarTratamentoErros(aplicacao)
  await registrarRotasSaude(aplicacao)
  await registrarRotasAutenticacao(aplicacao)
  await registrarRotasPacientes(aplicacao)
  await registrarRotasProfissionais(aplicacao)
  await registrarRotasServicos(aplicacao)
  await registrarRotasAgenda(aplicacao)
  await registrarRotasProntuario(aplicacao)
  await registrarRotasFormularios(aplicacao)
  await registrarRotasFinanceiro(aplicacao)
  await registrarRotasComunicacao(aplicacao)
  await registrarRotasPainel(aplicacao)
  aplicacao.addHook('onClose', async () => prisma.$disconnect())
  return aplicacao
}
