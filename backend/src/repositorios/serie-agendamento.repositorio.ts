import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a serieAgendamento; aceita a conexão da transação existente. */
export function repositorioSerieAgendamento(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.serieAgendamento
  return {
    criar: entidade.create.bind(entidade),
  }
}
