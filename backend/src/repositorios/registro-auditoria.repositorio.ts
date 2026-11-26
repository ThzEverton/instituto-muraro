import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a registroAuditoria; aceita a conexão da transação existente. */
export function repositorioRegistroAuditoria(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.registroAuditoria
  return {
    criar: entidade.create.bind(entidade),
  }
}
