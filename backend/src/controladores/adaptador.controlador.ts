import type { FastifyReply } from 'fastify'
import type { RequisicaoAutenticada } from '../tipos/requisicao.js'
import { ResultadoOperacao, type EntradaOperacao } from '../tipos/operacao.js'

/** Único adaptador HTTP para os serviços de aplicação. */
export function criarControlador(executar: (entrada: EntradaOperacao) => Promise<unknown>, opcoes: { semCache?: boolean } = {}) {
  return async (req: RequisicaoAutenticada, res: FastifyReply) => {
    if (opcoes.semCache) res.header('Cache-Control', 'no-store')
    const resposta = await executar({ corpo: req.body, consulta: req.query, parametros: req.params, identidade: req.identidade, tokenHash: req.tokenHash })
    if (resposta instanceof ResultadoOperacao) return res.code(resposta.status).send(resposta.corpo)
    return resposta
  }
}
