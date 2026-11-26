import type { FastifyRequest } from 'fastify'
import type { Identidade } from './operacao.js'
export type RequisicaoAutenticada = FastifyRequest & { identidade?: Identidade; tokenHash?: string }
