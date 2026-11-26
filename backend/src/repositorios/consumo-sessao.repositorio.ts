import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a consumoSessao; aceita a conexão da transação existente. */
export function repositorioConsumoSessao(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.consumoSessao
  return {
    criar: entidade.create.bind(entidade),
  }
}
