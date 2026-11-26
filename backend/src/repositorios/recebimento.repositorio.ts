import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a recebimento; aceita a conexão da transação existente. */
export function repositorioRecebimento(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.recebimento
  return {
    agregar: entidade.aggregate.bind(entidade),
    criar: entidade.create.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
