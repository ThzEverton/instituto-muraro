import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/pacientes.servico.js'

export const listarPacientes = criarControlador(servico.listarPacientes)
export const criarPaciente = criarControlador(servico.criarPaciente)
export const buscarPaciente = criarControlador(servico.buscarPaciente)
export const atualizarPaciente = criarControlador(servico.atualizarPaciente)
