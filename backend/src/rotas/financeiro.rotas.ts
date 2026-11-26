import type { FastifyInstance } from 'fastify'
import { exigirPerfis } from '../middlewares/autenticacao.middleware.js'
import * as controlador from '../controladores/financeiro.controlador.js'

const admin = exigirPerfis(['ADMINISTRADOR'])
const equipe = exigirPerfis(['ADMINISTRADOR','RECEPCAO'])

export async function registrarRotasFinanceiro(app:FastifyInstance) {
  app.get('/api/v1/financeiro/parcerias', {preHandler:equipe}, controlador.listarParcerias)
  app.post('/api/v1/financeiro/parcerias', {preHandler:admin}, controlador.criarParceria)
  app.patch('/api/v1/financeiro/parcerias/:id', {preHandler:admin}, controlador.atualizarParceria)
  app.get('/api/v1/financeiro/taxas', {preHandler:admin}, controlador.listarTaxas)
  app.post('/api/v1/financeiro/taxas', {preHandler:admin}, controlador.criarTaxa)
  app.get('/api/v1/financeiro/planos', {preHandler:equipe}, controlador.listarPlanos)
  app.post('/api/v1/financeiro/planos', {preHandler:admin}, controlador.criarPlano)
  app.patch('/api/v1/financeiro/planos/:id', {preHandler:admin}, controlador.atualizarPlano)
  app.get('/api/v1/financeiro/contratos', {preHandler:admin}, controlador.listarContratos)
  app.post('/api/v1/financeiro/contratos', {preHandler:admin}, controlador.criarContrato)
  app.post('/api/v1/financeiro/consumos', {preHandler:admin}, controlador.registrarConsumo)
  app.get('/api/v1/financeiro/cobrancas', {preHandler:admin}, controlador.listarCobrancas)
  app.post('/api/v1/financeiro/cobrancas', {preHandler:admin}, controlador.criarCobranca)
  app.patch('/api/v1/financeiro/cobrancas/:id/cancelar', {preHandler:admin}, controlador.cancelarCobranca)
  app.post('/api/v1/financeiro/cobrancas/:id/recebimentos', {preHandler:admin}, controlador.registrarRecebimento)
  app.patch('/api/v1/financeiro/recebimentos/:id/estornar', {preHandler:admin}, controlador.estornarRecebimento)
  app.get('/api/v1/financeiro/despesas', {preHandler:admin}, controlador.listarDespesas)
  app.post('/api/v1/financeiro/despesas', {preHandler:admin}, controlador.criarDespesa)
  app.patch('/api/v1/financeiro/despesas/:id/estornar', {preHandler:admin}, controlador.estornarDespesa)
  app.get('/api/v1/financeiro/comissoes', {preHandler:admin}, controlador.listarComissoes)
  app.post('/api/v1/financeiro/comissoes', {preHandler:admin}, controlador.registrarComissao)
  app.patch('/api/v1/financeiro/comissoes/:id/pagar', {preHandler:admin}, controlador.pagarComissao)
  app.get('/api/v1/financeiro/relatorio', {preHandler:admin}, controlador.consultarRelatorio)
  app.get('/api/v1/configuracao', {preHandler:equipe}, controlador.consultarConfiguracao)
  app.patch('/api/v1/configuracao', {preHandler:admin}, controlador.salvarConfiguracao)
}
