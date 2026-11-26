import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a entradaProntuario; aceita a conexão da transação existente. */
export function repositorioEntradaProntuario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.entradaProntuario
  return {
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnicoOuFalhar: entidade.findUniqueOrThrow.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}
