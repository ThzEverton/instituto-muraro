import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/formularios.servico.js'

export const listarModelos = criarControlador(servico.listarModelos)
export const criarModelo = criarControlador(servico.criarModelo)
export const atualizarModelo = criarControlador(servico.atualizarModelo)
export const publicarModelo = criarControlador(servico.publicarModelo)
export const criarVersaoModelo = criarControlador(servico.criarVersaoModelo)
export const listarLinks = criarControlador(servico.listarLinks)
export const emitirLink = criarControlador(servico.emitirLink)
export const revogarLink = criarControlador(servico.revogarLink)
export const consultarFormularioPublico = criarControlador(servico.consultarFormularioPublico, { semCache: true })
export const enviarFormularioPublico = criarControlador(servico.enviarFormularioPublico, { semCache: true })
