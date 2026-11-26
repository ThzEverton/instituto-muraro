import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a expedienteProfissional; aceita a conexão da transação existente. */
export function repositorioExpedienteProfissional(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.expedienteProfissional
  return {
    listar: entidade.findMany.bind(entidade),
  }
}
