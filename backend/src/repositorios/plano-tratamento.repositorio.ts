import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a planoTratamento; aceita a conexão da transação existente. */
export function repositorioPlanoTratamento(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.planoTratamento
  return {
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
