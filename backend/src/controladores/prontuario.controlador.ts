import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/prontuario.servico.js'

export const listarContas = criarControlador(servico.listarContas)
export const criarConta = criarControlador(servico.criarConta)
export const associarConta = criarControlador(servico.associarConta)
export const listarVinculos = criarControlador(servico.listarVinculos)
export const salvarVinculo = criarControlador(servico.salvarVinculo)
export const listarPacientesClinicos = criarControlador(servico.listarPacientesClinicos)
export const consultarProntuario = criarControlador(servico.consultarProntuario)
export const criarEntrada = criarControlador(servico.criarEntrada)
export const atualizarEntrada = criarControlador(servico.atualizarEntrada)
