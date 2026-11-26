import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a profissionalServico; aceita a conexão da transação existente. */
export function repositorioProfissionalServico(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.profissionalServico
  return {
    buscarUnico: entidade.findUnique.bind(entidade),
  }
}
