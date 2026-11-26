import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/servicos.servico.js'

export const listarServicos = criarControlador(servico.listarServicos)
export const criarServico = criarControlador(servico.criarServico)
export const buscarServico = criarControlador(servico.buscarServico)
export const atualizarServico = criarControlador(servico.atualizarServico)
