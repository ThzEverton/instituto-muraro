import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a respostaFormulario; aceita a conexão da transação existente. */
export function repositorioRespostaFormulario(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.respostaFormulario
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
  }
}
