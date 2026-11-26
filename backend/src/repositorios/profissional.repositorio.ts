import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a profissional; aceita a conexão da transação existente. */
export function repositorioProfissional(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.profissional
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}
