import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a linkFormulario; aceita a conexão da transação existente. */
export function repositorioLinkFormulario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.linkFormulario
  return {
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    buscarUnicoOuFalhar: entidade.findUniqueOrThrow.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}
