import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a paciente; aceita a conexão da transação existente. */
export function repositorioPaciente(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.paciente
  return {
    contar: entidade.count.bind(entidade),
    criar: entidade.create.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    buscarUnicoOuFalhar: entidade.findUniqueOrThrow.bind(entidade),
    atualizar: entidade.update.bind(entidade),
  }
}

export async function travarPaciente(conexao: Prisma.TransactionClient, id: string) {
  await conexao.$queryRaw`SELECT id FROM pacientes WHERE id = ${id} FOR UPDATE`
}

export function listarPacientesPaginados(filtros: { busca?: string; ativo?: 'true' | 'false'; pagina: number; limite: number }) {
  const { busca, ativo, pagina, limite } = filtros
  const where: Prisma.PacienteWhereInput = {
    ...(ativo ? { ativo: ativo === 'true' } : {}),
    ...(busca ? { nomeCompleto: { contains: busca, mode: 'insensitive' } } : {}),
  }
  return prisma.$transaction([
    prisma.paciente.count({ where }),
    prisma.paciente.findMany({ where, orderBy: { nomeCompleto: 'asc' }, skip: (pagina - 1) * limite, take: limite }),
  ])
}
