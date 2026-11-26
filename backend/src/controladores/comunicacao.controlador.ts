import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/comunicacao.servico.js'

export const listarRegras = criarControlador(servico.listarRegras)
export const atualizarRegra = criarControlador(servico.atualizarRegra)
export const atualizarAutorizacaoWhatsApp = criarControlador(servico.atualizarAutorizacaoWhatsApp)
export const gerarPendencias = criarControlador(servico.gerarPendencias)
export const listarFila = criarControlador(servico.listarFila)
export const prepararEnvio = criarControlador(servico.prepararEnvio)
export const registrarEnvio = criarControlador(servico.registrarEnvio)
export const cancelarMensagem = criarControlador(servico.cancelarMensagem)
