import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a regraComunicacao; aceita a conexão da transação existente. */
export function repositorioRegraComunicacao(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.regraComunicacao
  return {
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    criarOuAtualizar: entidade.upsert.bind(entidade),
  }
}
