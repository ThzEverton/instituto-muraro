import { criarControlador } from './adaptador.controlador.js'
import * as servico from '../servicos/painel.servico.js'

export const consultarResumo = criarControlador(servico.consultarResumo)
