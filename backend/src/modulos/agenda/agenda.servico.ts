import { Prisma, type SituacaoAgendamento } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { dataLocal } from './agenda.validacao.js'

const situacoesOcupadas: SituacaoAgendamento[] = [
  'AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO',
]

export type DadosAgendamento = {
  pacienteId: string; profissionalId: string; servicoId: string;
  inicioEm: Date; fimEm: Date;
}

export class ConflitoAgenda extends Error {}
export class DadosAgendaInvalidos extends Error {}

export async function verificarEGravarAgendamento(
  dados: DadosAgendamento,
  usuarioId: string,
  id?: string,
  situacao?: SituacaoAgendamento,
) {
  const inicio = dataLocal(dados.inicioEm)
  const fim = dataLocal(dados.fimEm)
  if (inicio.data !== fim.data || dados.fimEm <= dados.inicioEm) {
    throw new DadosAgendaInvalidos('Agendamento deve ocorrer em um único dia')
  }
  return prisma.$transaction(async (transacao) => {
    // Serializa alterações da agenda do mesmo profissional e dia.
    await transacao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${dados.profissionalId}), hashtext(${inicio.data}))::text`
    const [paciente, profissional, servico] = await Promise.all([
      transacao.paciente.findUnique({ where: { id: dados.pacienteId }, select: { ativo: true } }),
      transacao.profissional.findUnique({ where: { id: dados.profissionalId }, select: { ativo: true } }),
      transacao.servico.findUnique({ where: { id: dados.servicoId }, select: { ativo: true, capacidade: true, duracaoMinutos: true } }),
    ])
    if (!paciente?.ativo || !profissional?.ativo || !servico?.ativo) {
      throw new DadosAgendaInvalidos('Paciente, profissional ou serviço inexistente ou inativo')
    }
    if (dados.fimEm.getTime() - dados.inicioEm.getTime() !== servico.duracaoMinutos * 60_000) {
      throw new DadosAgendaInvalidos('Duração diferente da configurada para o serviço')
    }
    const habilitado = await transacao.profissionalServico.findUnique({
      where: { profissionalId_servicoId: { profissionalId: dados.profissionalId, servicoId: dados.servicoId } },
    })
    if (!habilitado) throw new DadosAgendaInvalidos('Serviço não habilitado para o profissional')
    const expediente = await transacao.expedienteProfissional.findMany({
      where: { profissionalId: dados.profissionalId, diaSemana: inicio.diaSemana },
    })
    if (!expediente.some((item) => item.inicioMinuto <= inicio.minuto && item.fimMinuto >= fim.minuto)) {
      throw new ConflitoAgenda('Horário fora do expediente')
    }
    const bloqueio = await transacao.bloqueioAgenda.findFirst({
      where: {
        profissionalId: dados.profissionalId,
        inicioEm: { lt: dados.fimEm },
        fimEm: { gt: dados.inicioEm },
      },
    })
    if (bloqueio) throw new ConflitoAgenda('Horário bloqueado')
    const ocupantes = await transacao.agendamento.findMany({
      where: {
        profissionalId: dados.profissionalId,
        id: id ? { not: id } : undefined,
        situacao: { in: situacoesOcupadas },
        inicioEm: { lt: dados.fimEm },
        fimEm: { gt: dados.inicioEm },
      },
      select: { servicoId: true },
    })
    if (ocupantes.some((item) => item.servicoId !== dados.servicoId) || ocupantes.length >= servico.capacidade) {
      throw new ConflitoAgenda('Capacidade esgotada ou serviço incompatível no horário')
    }
    const agendamento = id
      ? await transacao.agendamento.update({ where: { id }, data: { ...dados, ...(situacao ? { situacao } : {}) } })
      : await transacao.agendamento.create({ data: dados })
    await transacao.registroAuditoria.create({
      data: { usuarioId, acao: id ? 'REAGENDAR' : 'AGENDAR', entidade: 'agendamento', entidadeId: agendamento.id },
    })
    return agendamento
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })
}
