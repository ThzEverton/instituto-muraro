import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a usuario; aceita a conexão da transação existente. */
export function repositorioUsuario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.usuario
  return {
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
  }
}
