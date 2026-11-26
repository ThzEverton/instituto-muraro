import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a despesa; aceita a conexão da transação existente. */
export function repositorioDespesa(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.despesa
  return {
    agregar: entidade.aggregate.bind(entidade),
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
