import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a agendamento; aceita a conexão da transação existente. */
export function repositorioAgendamento(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.agendamento
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    buscarPrimeiro: entidade.findFirst.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    buscarUnicoOuFalhar: entidade.findUniqueOrThrow.bind(entidade),
    atualizar: entidade.update.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}

export async function travarAgendamento(conexao: Prisma.TransactionClient, id: string) {
  await conexao.$queryRaw`SELECT id FROM agendamentos WHERE id = ${id} FOR UPDATE`
}
