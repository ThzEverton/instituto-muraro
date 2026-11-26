import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a vinculoClinico; aceita a conexão da transação existente. */
export function repositorioVinculoClinico(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.vinculoClinico
  return {
    listar: entidade.findMany.bind(entidade),
    criarOuAtualizar: entidade.upsert.bind(entidade),
  }
}
