import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a prontuario; aceita a conexão da transação existente. */
export function repositorioProntuario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.prontuario
  return {
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
  }
}
