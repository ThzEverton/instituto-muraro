import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/profissionais.servico.js'

export const listarProfissionais = criarControlador(servico.listarProfissionais)
export const criarProfissional = criarControlador(servico.criarProfissional)
export const buscarProfissional = criarControlador(servico.buscarProfissional)
export const atualizarProfissional = criarControlador(servico.atualizarProfissional)
