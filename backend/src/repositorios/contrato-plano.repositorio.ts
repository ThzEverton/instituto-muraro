import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a contratoPlano; aceita a conexão da transação existente. */
export function repositorioContratoPlano(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.contratoPlano
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
  }
}
