import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a ausenciaAgenda; aceita a conexão da transação existente. */
export function repositorioAusenciaAgenda(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.ausenciaAgenda
  return {
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}
