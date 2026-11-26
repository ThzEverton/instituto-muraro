import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a cobranca; aceita a conexão da transação existente. */
export function repositorioCobranca(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.cobranca
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    buscarUnicoOuFalhar: entidade.findUniqueOrThrow.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
