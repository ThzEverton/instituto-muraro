import type { PerfilUsuario } from '@prisma/client'

export type Identidade = { id: string; perfil: PerfilUsuario }
export type EntradaOperacao = { corpo: unknown; consulta: unknown; parametros: unknown; identidade?: Identidade; tokenHash?: string }

/** Resultado explícito para preservar status/erros do contrato na migração MVC. */
export class ResultadoOperacao<T> { constructor(public readonly status: number, public readonly corpo: T) {} }
export function resultado<T>(status: number, corpo: T) { return new ResultadoOperacao(status, corpo) }
