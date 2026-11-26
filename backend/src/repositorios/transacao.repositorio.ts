import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Mantém as operações PrismaPromise e o contexto de transação original. */
export const emTransacao: typeof prisma.$transaction = prisma.$transaction.bind(prisma)
export async function travarAgendaDia(conexao: Prisma.TransactionClient, dia: string) {
  await conexao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('agenda:dia'), hashtext(${dia}))::text`
}
export async function travarAgendaRecurso(conexao: Prisma.TransactionClient, recurso: string, dia: string) {
  await conexao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${recurso}), hashtext(${dia}))::text`
}
export async function travarFinanceiro(conexao: Prisma.TransactionClient) {
  await conexao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro'), 1)::text`
}
export async function travarFormulario(conexao: Prisma.TransactionClient, chave: string) {
  await conexao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('formulario'), hashtext(${chave}))::text`
}
export async function travarProntuario(conexao: Prisma.TransactionClient, pacienteId: string) {
  await conexao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('prontuario'), hashtext(${pacienteId}))::text`
}
