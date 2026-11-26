import { criarControlador } from './adaptador.controlador.js'
import { consultarSaude } from '../servicos/saude.servico.js'

export const consultar = criarControlador(consultarSaude)
