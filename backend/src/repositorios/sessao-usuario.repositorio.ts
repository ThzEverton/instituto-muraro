import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a sessaoUsuario; aceita a conexão da transação existente. */
export function repositorioSessaoUsuario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.sessaoUsuario
  return {
    criar: entidade.create.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}
