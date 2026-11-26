import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a configuracaoClinica; aceita a conexão da transação existente. */
export function repositorioConfiguracaoClinica(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.configuracaoClinica
  return {
    buscarUnico: entidade.findUnique.bind(entidade),
    criarOuAtualizar: entidade.upsert.bind(entidade),
  }
}
