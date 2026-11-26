import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a bloqueioAgenda; aceita a conexão da transação existente. */
export function repositorioBloqueioAgenda(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.bloqueioAgenda
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
