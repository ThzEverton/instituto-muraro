import { travarAgendamento } from '../repositorios/agendamento.repositorio.js'
import { travarAgendaRecurso } from '../repositorios/transacao.repositorio.js'
import { travarAgendaDia } from '../repositorios/transacao.repositorio.js'
import { repositorioAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioAusenciaAgenda } from '../repositorios/ausencia-agenda.repositorio.js'
import { repositorioBloqueioAgenda } from '../repositorios/bloqueio-agenda.repositorio.js'
import { repositorioExpedienteProfissional } from '../repositorios/expediente-profissional.repositorio.js'
import { repositorioPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioProfissional } from '../repositorios/profissional.repositorio.js'
import { repositorioProfissionalServico } from '../repositorios/profissional-servico.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioSala } from '../repositorios/sala.repositorio.js'
import { repositorioSerieAgendamento } from '../repositorios/serie-agendamento.repositorio.js'
import { repositorioServico } from '../repositorios/servico.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma, type SituacaoAgendamento } from '@prisma/client'
import { consultaAgenda, consultaDisponibilidade, dataLocal, edicaoAgendamento, entradaAgendamento, entradaBloqueio, entradaSala, entradaSerie, entradaAusencia, diasDoPeriodo, inicioDiaLocal, diaSeguinte } from '../validacoes/agenda.validacao.js'

const situacoesOcupadas: SituacaoAgendamento[] = [
  'AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO',
]

export type DadosAgendamento = {
  pacienteId: string; profissionalId: string; servicoId: string;
  inicioEm: Date; fimEm: Date; salaId?: string | null; serieId?: string;
}

export class ConflitoAgenda extends Error {}

export class DadosAgendaInvalidos extends Error {}

async function gravarNaTransacao(
  transacao: Prisma.TransactionClient,
  dados: DadosAgendamento,
  usuarioId: string,
  id?: string,
  situacao?: SituacaoAgendamento,
) {
  if (id) {
    await travarAgendamento(transacao, id)
    const atual = await repositorioAgendamento(transacao).buscarUnico({where:{id}})
    if (!atual || ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'].includes(atual.situacao)) throw new ConflitoAgenda('Agendamento encerrado ou inexistente')
  }
  const inicio = dataLocal(dados.inicioEm)
  const fim = dataLocal(dados.fimEm)
  if (inicio.data !== fim.data || dados.fimEm <= dados.inicioEm) {
    throw new DadosAgendaInvalidos('Agendamento deve ocorrer em um único dia')
  }
    await travarAgendaDia(transacao, inicio.data)
    const ausencia = await repositorioAusenciaAgenda(transacao).buscarPrimeiro({ where: {
      ativo: true, dataInicio: { lte: inicio.data }, dataFim: { gte: inicio.data },
      OR: [{ profissionalId: null }, { profissionalId: dados.profissionalId }],
    } })
    if (ausencia) throw new ConflitoAgenda('Agenda fechada: ' + ausencia.motivo)
    // Serializa alterações da agenda do mesmo profissional e dia.
    await travarAgendaRecurso(transacao, dados.profissionalId, inicio.data)
    await travarAgendaRecurso(transacao, 'paciente:' + dados.pacienteId, inicio.data)
    if (dados.salaId) await travarAgendaRecurso(transacao, 'sala:' + dados.salaId, inicio.data)
    const ocupadoPaciente = await repositorioAgendamento(transacao).buscarPrimeiro({
      where: { pacienteId: dados.pacienteId, id: id ? { not: id } : undefined, situacao: { in: situacoesOcupadas }, inicioEm: { lt: dados.fimEm }, fimEm: { gt: dados.inicioEm } },
    })
    if (ocupadoPaciente) throw new ConflitoAgenda('Paciente ja possui atendimento no horario')
    if (dados.salaId) {
      const sala = await repositorioSala(transacao).buscarUnico({ where: { id: dados.salaId } })
      if (!sala?.ativo) throw new DadosAgendaInvalidos('Sala inexistente ou inativa')
      const ocupacao = await repositorioAgendamento(transacao).contar({
        where: { salaId: dados.salaId, id: id ? { not: id } : undefined, situacao: { in: situacoesOcupadas }, inicioEm: { lt: dados.fimEm }, fimEm: { gt: dados.inicioEm } },
      })
      if (ocupacao >= sala.capacidade) throw new ConflitoAgenda('Capacidade da sala esgotada')
    }
    const [paciente, profissional, servico] = await Promise.all([
      repositorioPaciente(transacao).buscarUnico({ where: { id: dados.pacienteId }, select: { ativo: true } }),
      repositorioProfissional(transacao).buscarUnico({ where: { id: dados.profissionalId }, select: { ativo: true } }),
      repositorioServico(transacao).buscarUnico({ where: { id: dados.servicoId }, select: { ativo: true, capacidade: true, duracaoMinutos: true } }),
    ])
    if (!paciente?.ativo || !profissional?.ativo || !servico?.ativo) {
      throw new DadosAgendaInvalidos('Paciente, profissional ou serviço inexistente ou inativo')
    }
    if (dados.fimEm.getTime() - dados.inicioEm.getTime() !== servico.duracaoMinutos * 60_000) {
      throw new DadosAgendaInvalidos('Duração diferente da configurada para o serviço')
    }
    const habilitado = await repositorioProfissionalServico(transacao).buscarUnico({
      where: { profissionalId_servicoId: { profissionalId: dados.profissionalId, servicoId: dados.servicoId } },
    })
    if (!habilitado) throw new DadosAgendaInvalidos('Serviço não habilitado para o profissional')
    const expediente = await repositorioExpedienteProfissional(transacao).listar({
      where: { profissionalId: dados.profissionalId, diaSemana: inicio.diaSemana },
    })
    if (!expediente.some((item) => item.inicioMinuto <= inicio.minuto && item.fimMinuto >= fim.minuto)) {
      throw new ConflitoAgenda('Horário fora do expediente')
    }
    const bloqueio = await repositorioBloqueioAgenda(transacao).buscarPrimeiro({
      where: {
        profissionalId: dados.profissionalId,
        ativo: true,
        inicioEm: { lt: dados.fimEm },
        fimEm: { gt: dados.inicioEm },
      },
    })
    if (bloqueio) throw new ConflitoAgenda('Horário bloqueado')
    const ocupantes = await repositorioAgendamento(transacao).listar({
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
      ? await repositorioAgendamento(transacao).atualizar({ where: { id }, data: { ...dados, ...(situacao ? { situacao } : {}) } })
      : await repositorioAgendamento(transacao).criar({ data: dados })
    await repositorioRegistroAuditoria(transacao).criar({
      data: { usuarioId, acao: id ? 'REAGENDAR' : 'AGENDAR', entidade: 'agendamento', entidadeId: agendamento.id },
    })
    return agendamento
}

export async function verificarEGravarAgendamento(dados: DadosAgendamento, usuarioId: string, id?: string, situacao?: SituacaoAgendamento) {
  return emTransacao(t => gravarNaTransacao(t, dados, usuarioId, id, situacao),
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })
}

export async function criarSerie(dados: DadosAgendamento, usuarioId: string, quantidade: number, intervaloSemanas: number) {
  return emTransacao(async t => {
    const serie = await repositorioSerieAgendamento(t).criar({ data: { quantidade, intervaloSemanas } })
    const agendamentos = []
    for (let i = 0; i < quantidade; i++) {
      const deslocamento = i * intervaloSemanas * 7 * 86400000
      const inicioEm = new Date(dados.inicioEm.getTime() + deslocamento)
      const fimEm = new Date(dados.fimEm.getTime() + deslocamento)
      try {
        agendamentos.push(await gravarNaTransacao(t, { ...dados, inicioEm, fimEm, serieId: serie.id }, usuarioId))
      } catch (erro) {
        if (erro instanceof ConflitoAgenda) throw new ConflitoAgenda(dataLocal(inicioEm).data + ': ' + erro.message)
        throw erro
      }
    }
    return { serieId: serie.id, agendamentos }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 })
}

function erroAgenda(erro: unknown) {
  if (erro instanceof ConflitoAgenda) return retornarResultado(409, { erro: erro.message })
  if (erro instanceof DadosAgendaInvalidos) return retornarResultado(400, { erro: erro.message })
  throw erro
}

export async function listarAusencias(requisicao: EntradaOperacao) {
    const r = consultaAgenda.safeParse(requisicao.consulta)
    if (!r.success) return retornarResultado(400, { erro: 'Periodo invalido' })
    const { inicioEm, fimEm, profissionalId } = r.data
    const dados = await repositorioAusenciaAgenda().listar({ where: {
      ativo: true, dataInicio: { lte: dataLocal(new Date(fimEm)).data }, dataFim: { gte: dataLocal(new Date(inicioEm)).data },
      ...(profissionalId ? { OR: [{ profissionalId: null }, { profissionalId }] } : {}),
    }, orderBy: { dataInicio: 'asc' } })
    return { dados }
}

export async function criarAusencia(requisicao: EntradaOperacao) {
    const r = entradaAusencia.safeParse(requisicao.corpo)
    if (!r.success) return retornarResultado(400, { erro: 'Periodo ou motivo invalido' })
    const dados = r.data
    try {
      const criado = await emTransacao(async t => {
        for (const dia of diasDoPeriodo(dados.dataInicio, dados.dataFim)) {
          await travarAgendaDia(t, dia)
        }
        if (dados.profissionalId && !(await repositorioProfissional(t).buscarUnico({ where: { id: dados.profissionalId } }))?.ativo) throw new DadosAgendaInvalidos('Profissional inexistente ou inativo')
        const agendado = await repositorioAgendamento(t).buscarPrimeiro({ where: {
          ...(dados.profissionalId ? { profissionalId: dados.profissionalId } : {}),
          situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] },
          inicioEm: { lt: inicioDiaLocal(diaSeguinte(dados.dataFim)) }, fimEm: { gt: inicioDiaLocal(dados.dataInicio) },
        } })
        if (agendado) throw new ConflitoAgenda('Existem atendimentos no periodo. Reagende ou cancele antes de fechar a agenda.')
        const item = await repositorioAusenciaAgenda(t).criar({ data: dados })
        await repositorioRegistroAuditoria(t).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'BLOQUEAR_PERIODO', entidade: 'ausencia_agenda', entidadeId: item.id } })
        return item
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 })
      return retornarResultado(201, { dados: criado })
    } catch (e) { return erroAgenda(e) }
}

export async function inativarAusencia(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const dados = await emTransacao(async t => {
      const atualizado = await repositorioAusenciaAgenda(t).atualizarVarios({ where: { id, ativo: true }, data: { ativo: false } })
      if (!atualizado.count) return null
      await repositorioRegistroAuditoria(t).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'DESBLOQUEAR_PERIODO', entidade: 'ausencia_agenda', entidadeId: id } })
      return repositorioAusenciaAgenda(t).buscarUnico({ where: { id } })
    })
    if (!dados) return retornarResultado(404, { erro: 'Periodo nao encontrado' })
    return { dados }
}

export async function listarSalas() {
    return { dados: await repositorioSala().listar({ orderBy: { nome: 'asc' } }) }
}

export async function criarSala(requisicao: EntradaOperacao) {
    const r = entradaSala.safeParse(requisicao.corpo)
    if (!r.success) return retornarResultado(400, { erro: 'Dados da sala invalidos' })
    try {
      const sala = await emTransacao(async t => {
        const item = await repositorioSala(t).criar({ data: r.data })
        await repositorioRegistroAuditoria(t).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'sala', entidadeId: item.id } })
        return item
      })
      return retornarResultado(201, { dados: sala })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return retornarResultado(409, { erro: 'Nome de sala ja cadastrado' })
      throw e
    }
}

export async function criarSerieAgendamentos(requisicao: EntradaOperacao) {
    const r = entradaSerie.safeParse(requisicao.corpo)
    if (!r.success) return retornarResultado(400, { erro: 'Dados da serie invalidos' })
    const { quantidade, intervaloSemanas, ...dados } = r.data
    try {
      const serie = await criarSerie({ ...dados, inicioEm: new Date(dados.inicioEm), fimEm: new Date(dados.fimEm) }, requisicao.identidade!.id, quantidade, intervaloSemanas)
      return retornarResultado(201, { dados: serie })
    } catch (e) { return erroAgenda(e) }
}

export async function consultarDisponibilidadeAgenda(requisicao: EntradaOperacao) {
    const resultado = consultaDisponibilidade.safeParse(requisicao.consulta)
    if (!resultado.success) return retornarResultado(400, { erro: 'Consulta inválida' })
    const { profissionalId, servicoId, inicioEm, salaId } = resultado.data
    const inicio = new Date(inicioEm)
    const servico = await repositorioServico().buscarUnico({ where: { id: servicoId } })
    const profissional = await repositorioProfissional().buscarUnico({ where: { id: profissionalId } })
    if (!servico?.ativo || !profissional?.ativo) return retornarResultado(404, { erro: 'Profissional ou serviço indisponível' })
    const fim = new Date(inicio.getTime() + servico.duracaoMinutos * 60_000)
    const localInicio = dataLocal(inicio)
    const localFim = dataLocal(fim)
    const [vinculo, expedientes, bloqueios, agendamentos] = await Promise.all([
      repositorioProfissionalServico().buscarUnico({ where: { profissionalId_servicoId: { profissionalId, servicoId } } }),
      repositorioExpedienteProfissional().listar({ where: { profissionalId, diaSemana: localInicio.diaSemana } }),
      repositorioBloqueioAgenda().contar({ where: { profissionalId, ativo: true, inicioEm: { lt: fim }, fimEm: { gt: inicio } } }),
      repositorioAgendamento().listar({
        where: { profissionalId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fim }, fimEm: { gt: inicio } },
        select: { servicoId: true },
      }),
    ])
    const dentroDoExpediente = localInicio.data === localFim.data && expedientes.some((item) =>
      item.inicioMinuto <= localInicio.minuto && item.fimMinuto >= localFim.minuto)
    const compativel = agendamentos.every((item) => item.servicoId === servicoId)
    const vagasRestantes = vinculo && dentroDoExpediente && !bloqueios && compativel ? Math.max(0, servico.capacidade - agendamentos.length) : 0
    const ausencia = await repositorioAusenciaAgenda().buscarPrimeiro({ where: {
      ativo: true, dataInicio: { lte: localInicio.data }, dataFim: { gte: localInicio.data },
      OR: [{ profissionalId: null }, { profissionalId }],
    } })
    let vagas = ausencia ? 0 : vagasRestantes
    if (salaId) {
      const sala = await repositorioSala().buscarUnico({ where: { id: salaId } })
      const ocupacao = await repositorioAgendamento().contar({ where: { salaId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fim }, fimEm: { gt: inicio } } })
      vagas = sala?.ativo ? Math.min(vagas, Math.max(0, sala.capacidade - ocupacao)) : 0
    }
    return { dados: { disponivel: vagas > 0, vagasRestantes: vagas } }
}

export async function listarBloqueios(requisicao: EntradaOperacao) {
    const resultado = consultaAgenda.safeParse(requisicao.consulta)
    if (!resultado.success) return retornarResultado(400, { erro: 'Período inválido' })
    const { inicioEm, fimEm, profissionalId } = resultado.data
    const dados = await repositorioBloqueioAgenda().listar({
      where: {
        ativo: true, inicioEm: { lt: new Date(fimEm) }, fimEm: { gt: new Date(inicioEm) },
        ...(profissionalId ? { profissionalId } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      take: 1000,
    })
    return { dados }
}

export async function criarBloqueio(requisicao: EntradaOperacao) {
    const resultado = entradaBloqueio.safeParse(requisicao.corpo)
    if (!resultado.success) return retornarResultado(400, { erro: 'Dados do bloqueio inválidos' })
    const { profissionalId, tipo } = resultado.data
    const inicioEm = new Date(resultado.data.inicioEm)
    const fimEm = new Date(resultado.data.fimEm)
    const inicio = dataLocal(inicioEm)
    if (inicio.data !== dataLocal(fimEm).data) return retornarResultado(400, { erro: 'Bloqueio deve ocorrer em um único dia' })
    try {
      const bloqueio = await emTransacao(async (transacao) => {
        await travarAgendaRecurso(transacao, profissionalId, inicio.data)
        const profissional = await repositorioProfissional(transacao).buscarUnico({ where: { id: profissionalId }, select: { ativo: true } })
        if (!profissional?.ativo) throw new DadosAgendaInvalidos('Profissional inexistente ou inativo')
        const [outro, agendamento] = await Promise.all([
          repositorioBloqueioAgenda(transacao).buscarPrimeiro({ where: { profissionalId, ativo: true, inicioEm: { lt: fimEm }, fimEm: { gt: inicioEm } } }),
          repositorioAgendamento(transacao).buscarPrimeiro({
            where: { profissionalId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fimEm }, fimEm: { gt: inicioEm } },
          }),
        ])
        if (outro || agendamento) throw new ConflitoAgenda('Horário ocupado')
        const criado = await repositorioBloqueioAgenda(transacao).criar({ data: { profissionalId, tipo, inicioEm, fimEm } })
        await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'BLOQUEAR', entidade: 'bloqueio_agenda', entidadeId: criado.id } })
        return criado
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })
      return retornarResultado(201, { dados: bloqueio })
    } catch (erro) { return erroAgenda(erro) }
}

export async function inativarBloqueio(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const bloqueio = await repositorioBloqueioAgenda().buscarUnico({ where: { id } })
    if (!bloqueio || !bloqueio.ativo) return retornarResultado(404, { erro: 'Bloqueio não encontrado' })
    const alterado = await emTransacao(async (transacao) => {
      const atualizado = await repositorioBloqueioAgenda(transacao).atualizar({ where: { id }, data: { ativo: false } })
      await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'DESBLOQUEAR', entidade: 'bloqueio_agenda', entidadeId: id } })
      return atualizado
    })
    return { dados: alterado }
}

export async function listarAgendamentos(requisicao: EntradaOperacao) {
    const resultado = consultaAgenda.safeParse(requisicao.consulta)
    if (!resultado.success) return retornarResultado(400, { erro: 'Período inválido' })
    const { inicioEm, fimEm, profissionalId, servicoId } = resultado.data
    const dados = await repositorioAgendamento().listar({
      where: {
        inicioEm: { lt: new Date(fimEm) }, fimEm: { gt: new Date(inicioEm) },
        ...(profissionalId ? { profissionalId } : {}),
        ...(servicoId ? { servicoId } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      take: 1000,
    })
    return { dados }
}

export async function criarAgendamento(requisicao: EntradaOperacao) {
    const resultado = entradaAgendamento.safeParse(requisicao.corpo)
    if (!resultado.success) return retornarResultado(400, { erro: 'Dados do agendamento inválidos' })
    try {
      const dados = resultado.data
      const agendamento = await verificarEGravarAgendamento({
        ...dados, inicioEm: new Date(dados.inicioEm), fimEm: new Date(dados.fimEm),
      }, requisicao.identidade!.id)
      return retornarResultado(201, { dados: agendamento })
    } catch (erro) { return erroAgenda(erro) }
}

export async function atualizarAgendamento(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const resultado = edicaoAgendamento.safeParse(requisicao.corpo)
    if (!resultado.success || !Object.keys(resultado.data).length) return retornarResultado(400, { erro: 'Alterações inválidas' })
    const existente = await repositorioAgendamento().buscarUnico({ where: { id } })
    if (!existente) return retornarResultado(404, { erro: 'Agendamento não encontrado' })
    if (['CANCELADO', 'CONCLUIDO', 'NAO_COMPARECEU'].includes(existente.situacao)) {
      return retornarResultado(409, { erro: 'Agendamento encerrado não pode ser alterado' })
    }
    const { situacao, ...alteracoes } = resultado.data
    if (situacao && !Object.keys(alteracoes).length) {
      const agendamento = await emTransacao(async (transacao) => {
        const alterado = await repositorioAgendamento(transacao).atualizarVarios({ where: { id, situacao: { notIn: ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'] } }, data: { situacao } })
        if (!alterado.count) return null
        await repositorioRegistroAuditoria(transacao).criar({
          data: { usuarioId: requisicao.identidade!.id, acao: 'ALTERAR_SITUACAO', entidade: 'agendamento', entidadeId: id },
        })
        return repositorioAgendamento(transacao).buscarUnicoOuFalhar({where:{id}})
      })
      if (!agendamento) return retornarResultado(409, {erro:'Agendamento encerrado'})
      return { dados: agendamento }
    }
    const novos = {
      pacienteId: alteracoes.pacienteId ?? existente.pacienteId,
      profissionalId: alteracoes.profissionalId ?? existente.profissionalId,
      servicoId: alteracoes.servicoId ?? existente.servicoId,
      salaId: alteracoes.salaId === undefined ? existente.salaId : alteracoes.salaId,
      inicioEm: new Date(alteracoes.inicioEm ?? existente.inicioEm),
      fimEm: new Date(alteracoes.fimEm ?? existente.fimEm),
    }
    try {
      const agendamento = await verificarEGravarAgendamento(novos, requisicao.identidade!.id, id, situacao)
      return { dados: agendamento }
    } catch (erro) { return erroAgenda(erro) }
}
