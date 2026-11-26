import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/agenda.servico.js'

export const listarAusencias = criarControlador(servico.listarAusencias)
export const criarAusencia = criarControlador(servico.criarAusencia)
export const inativarAusencia = criarControlador(servico.inativarAusencia)
export const listarSalas = criarControlador(servico.listarSalas)
export const criarSala = criarControlador(servico.criarSala)
export const criarSerieAgendamentos = criarControlador(servico.criarSerieAgendamentos)
export const consultarDisponibilidadeAgenda = criarControlador(servico.consultarDisponibilidadeAgenda)
export const listarBloqueios = criarControlador(servico.listarBloqueios)
export const criarBloqueio = criarControlador(servico.criarBloqueio)
export const inativarBloqueio = criarControlador(servico.inativarBloqueio)
export const listarAgendamentos = criarControlador(servico.listarAgendamentos)
export const criarAgendamento = criarControlador(servico.criarAgendamento)
export const atualizarAgendamento = criarControlador(servico.atualizarAgendamento)
