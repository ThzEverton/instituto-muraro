import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/autenticacao.servico.js'

export const entrar = criarControlador(servico.entrar)
export const consultarSessao = criarControlador(servico.consultarSessao)
export const sair = criarControlador(servico.sair)
