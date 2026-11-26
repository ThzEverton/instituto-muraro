import { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { consultaAgenda, consultaDisponibilidade, dataLocal, edicaoAgendamento, entradaAgendamento, entradaBloqueio, entradaSala, entradaSerie, entradaAusencia, diasDoPeriodo, inicioDiaLocal, diaSeguinte } from './agenda.validacao.js'
import { ConflitoAgenda, DadosAgendaInvalidos, verificarEGravarAgendamento, criarSerie } from './agenda.servico.js'

const perfis = ['ADMINISTRADOR', 'RECEPCAO'] as const

function erroAgenda(erro: unknown, resposta: { code: (status: number) => { send: (corpo: object) => unknown } }) {
  if (erro instanceof ConflitoAgenda) return resposta.code(409).send({ erro: erro.message })
  if (erro instanceof DadosAgendaInvalidos) return resposta.code(400).send({ erro: erro.message })
  throw erro
}

export async function registrarRotasAgenda(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/agenda/ausencias', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const r = consultaAgenda.safeParse(requisicao.query)
    if (!r.success) return resposta.code(400).send({ erro: 'Periodo invalido' })
    const { inicioEm, fimEm, profissionalId } = r.data
    const dados = await prisma.ausenciaAgenda.findMany({ where: {
      ativo: true, dataInicio: { lte: dataLocal(new Date(fimEm)).data }, dataFim: { gte: dataLocal(new Date(inicioEm)).data },
      ...(profissionalId ? { OR: [{ profissionalId: null }, { profissionalId }] } : {}),
    }, orderBy: { dataInicio: 'asc' } })
    return { dados }
  })
  aplicacao.post('/api/v1/agenda/ausencias', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const r = entradaAusencia.safeParse(requisicao.body)
    if (!r.success) return resposta.code(400).send({ erro: 'Periodo ou motivo invalido' })
    const dados = r.data
    try {
      const criado = await prisma.$transaction(async t => {
        for (const dia of diasDoPeriodo(dados.dataInicio, dados.dataFim)) {
          await t.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('agenda:dia'), hashtext(${dia}))::text`
        }
        if (dados.profissionalId && !(await t.profissional.findUnique({ where: { id: dados.profissionalId } }))?.ativo) throw new DadosAgendaInvalidos('Profissional inexistente ou inativo')
        const agendado = await t.agendamento.findFirst({ where: {
          ...(dados.profissionalId ? { profissionalId: dados.profissionalId } : {}),
          situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] },
          inicioEm: { lt: inicioDiaLocal(diaSeguinte(dados.dataFim)) }, fimEm: { gt: inicioDiaLocal(dados.dataInicio) },
        } })
        if (agendado) throw new ConflitoAgenda('Existem atendimentos no periodo. Reagende ou cancele antes de fechar a agenda.')
        const item = await t.ausenciaAgenda.create({ data: dados })
        await t.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'BLOQUEAR_PERIODO', entidade: 'ausencia_agenda', entidadeId: item.id } })
        return item
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 })
      return resposta.code(201).send({ dados: criado })
    } catch (e) { return erroAgenda(e, resposta) }
  })
  aplicacao.patch('/api/v1/agenda/ausencias/:id', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const { id } = requisicao.params as { id: string }
    const dados = await prisma.$transaction(async t => {
      const atualizado = await t.ausenciaAgenda.updateMany({ where: { id, ativo: true }, data: { ativo: false } })
      if (!atualizado.count) return null
      await t.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'DESBLOQUEAR_PERIODO', entidade: 'ausencia_agenda', entidadeId: id } })
      return t.ausenciaAgenda.findUnique({ where: { id } })
    })
    if (!dados) return resposta.code(404).send({ erro: 'Periodo nao encontrado' })
    return { dados }
  })
  aplicacao.get('/api/v1/salas', { preHandler: exigirPerfis([...perfis]) }, async () => {
    return { dados: await prisma.sala.findMany({ orderBy: { nome: 'asc' } }) }
  })
  aplicacao.post('/api/v1/salas', { preHandler: exigirPerfis(['ADMINISTRADOR']) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const r = entradaSala.safeParse(requisicao.body)
    if (!r.success) return resposta.code(400).send({ erro: 'Dados da sala invalidos' })
    try {
      const sala = await prisma.$transaction(async t => {
        const item = await t.sala.create({ data: r.data })
        await t.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'sala', entidadeId: item.id } })
        return item
      })
      return resposta.code(201).send({ dados: sala })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return resposta.code(409).send({ erro: 'Nome de sala ja cadastrado' })
      throw e
    }
  })
  aplicacao.post('/api/v1/agendamentos/serie', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const r = entradaSerie.safeParse(requisicao.body)
    if (!r.success) return resposta.code(400).send({ erro: 'Dados da serie invalidos' })
    const { quantidade, intervaloSemanas, ...dados } = r.data
    try {
      const serie = await criarSerie({ ...dados, inicioEm: new Date(dados.inicioEm), fimEm: new Date(dados.fimEm) }, requisicao.identidade!.id, quantidade, intervaloSemanas)
      return resposta.code(201).send({ dados: serie })
    } catch (e) { return erroAgenda(e, resposta) }
  })
  aplicacao.get('/api/v1/agenda/disponibilidade', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const resultado = consultaDisponibilidade.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Consulta inválida' })
    const { profissionalId, servicoId, inicioEm, salaId } = resultado.data
    const inicio = new Date(inicioEm)
    const servico = await prisma.servico.findUnique({ where: { id: servicoId } })
    const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } })
    if (!servico?.ativo || !profissional?.ativo) return resposta.code(404).send({ erro: 'Profissional ou serviço indisponível' })
    const fim = new Date(inicio.getTime() + servico.duracaoMinutos * 60_000)
    const localInicio = dataLocal(inicio)
    const localFim = dataLocal(fim)
    const [vinculo, expedientes, bloqueios, agendamentos] = await Promise.all([
      prisma.profissionalServico.findUnique({ where: { profissionalId_servicoId: { profissionalId, servicoId } } }),
      prisma.expedienteProfissional.findMany({ where: { profissionalId, diaSemana: localInicio.diaSemana } }),
      prisma.bloqueioAgenda.count({ where: { profissionalId, ativo: true, inicioEm: { lt: fim }, fimEm: { gt: inicio } } }),
      prisma.agendamento.findMany({
        where: { profissionalId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fim }, fimEm: { gt: inicio } },
        select: { servicoId: true },
      }),
    ])
    const dentroDoExpediente = localInicio.data === localFim.data && expedientes.some((item) =>
      item.inicioMinuto <= localInicio.minuto && item.fimMinuto >= localFim.minuto)
    const compativel = agendamentos.every((item) => item.servicoId === servicoId)
    const vagasRestantes = vinculo && dentroDoExpediente && !bloqueios && compativel ? Math.max(0, servico.capacidade - agendamentos.length) : 0
    const ausencia = await prisma.ausenciaAgenda.findFirst({ where: {
      ativo: true, dataInicio: { lte: localInicio.data }, dataFim: { gte: localInicio.data },
      OR: [{ profissionalId: null }, { profissionalId }],
    } })
    let vagas = ausencia ? 0 : vagasRestantes
    if (salaId) {
      const sala = await prisma.sala.findUnique({ where: { id: salaId } })
      const ocupacao = await prisma.agendamento.count({ where: { salaId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fim }, fimEm: { gt: inicio } } })
      vagas = sala?.ativo ? Math.min(vagas, Math.max(0, sala.capacidade - ocupacao)) : 0
    }
    return { dados: { disponivel: vagas > 0, vagasRestantes: vagas } }
  })

  aplicacao.get('/api/v1/agenda/bloqueios', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const resultado = consultaAgenda.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Período inválido' })
    const { inicioEm, fimEm, profissionalId } = resultado.data
    const dados = await prisma.bloqueioAgenda.findMany({
      where: {
        ativo: true, inicioEm: { lt: new Date(fimEm) }, fimEm: { gt: new Date(inicioEm) },
        ...(profissionalId ? { profissionalId } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      take: 1000,
    })
    return { dados }
  })

  aplicacao.post('/api/v1/agenda/bloqueios', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = entradaBloqueio.safeParse(requisicao.body)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Dados do bloqueio inválidos' })
    const { profissionalId, tipo } = resultado.data
    const inicioEm = new Date(resultado.data.inicioEm)
    const fimEm = new Date(resultado.data.fimEm)
    const inicio = dataLocal(inicioEm)
    if (inicio.data !== dataLocal(fimEm).data) return resposta.code(400).send({ erro: 'Bloqueio deve ocorrer em um único dia' })
    try {
      const bloqueio = await prisma.$transaction(async (transacao) => {
        await transacao.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profissionalId}), hashtext(${inicio.data}))::text`
        const profissional = await transacao.profissional.findUnique({ where: { id: profissionalId }, select: { ativo: true } })
        if (!profissional?.ativo) throw new DadosAgendaInvalidos('Profissional inexistente ou inativo')
        const [outro, agendamento] = await Promise.all([
          transacao.bloqueioAgenda.findFirst({ where: { profissionalId, ativo: true, inicioEm: { lt: fimEm }, fimEm: { gt: inicioEm } } }),
          transacao.agendamento.findFirst({
            where: { profissionalId, situacao: { in: ['AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO'] }, inicioEm: { lt: fimEm }, fimEm: { gt: inicioEm } },
          }),
        ])
        if (outro || agendamento) throw new ConflitoAgenda('Horário ocupado')
        const criado = await transacao.bloqueioAgenda.create({ data: { profissionalId, tipo, inicioEm, fimEm } })
        await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'BLOQUEAR', entidade: 'bloqueio_agenda', entidadeId: criado.id } })
        return criado
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })
      return resposta.code(201).send({ dados: bloqueio })
    } catch (erro) { return erroAgenda(erro, resposta) }
  })

  aplicacao.patch('/api/v1/agenda/bloqueios/:id', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const { id } = requisicao.params as { id: string }
    const bloqueio = await prisma.bloqueioAgenda.findUnique({ where: { id } })
    if (!bloqueio || !bloqueio.ativo) return resposta.code(404).send({ erro: 'Bloqueio não encontrado' })
    const alterado = await prisma.$transaction(async (transacao) => {
      const atualizado = await transacao.bloqueioAgenda.update({ where: { id }, data: { ativo: false } })
      await transacao.registroAuditoria.create({ data: { usuarioId: requisicao.identidade!.id, acao: 'DESBLOQUEAR', entidade: 'bloqueio_agenda', entidadeId: id } })
      return atualizado
    })
    return { dados: alterado }
  })

  aplicacao.get('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, async (requisicao, resposta) => {
    const resultado = consultaAgenda.safeParse(requisicao.query)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Período inválido' })
    const { inicioEm, fimEm, profissionalId, servicoId } = resultado.data
    const dados = await prisma.agendamento.findMany({
      where: {
        inicioEm: { lt: new Date(fimEm) }, fimEm: { gt: new Date(inicioEm) },
        ...(profissionalId ? { profissionalId } : {}),
        ...(servicoId ? { servicoId } : {}),
      },
      orderBy: { inicioEm: 'asc' },
      take: 1000,
    })
    return { dados }
  })

  aplicacao.post('/api/v1/agendamentos', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const resultado = entradaAgendamento.safeParse(requisicao.body)
    if (!resultado.success) return resposta.code(400).send({ erro: 'Dados do agendamento inválidos' })
    try {
      const dados = resultado.data
      const agendamento = await verificarEGravarAgendamento({
        ...dados, inicioEm: new Date(dados.inicioEm), fimEm: new Date(dados.fimEm),
      }, requisicao.identidade!.id)
      return resposta.code(201).send({ dados: agendamento })
    } catch (erro) { return erroAgenda(erro, resposta) }
  })

  aplicacao.patch('/api/v1/agendamentos/:id', { preHandler: exigirPerfis([...perfis]) }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const { id } = requisicao.params as { id: string }
    const resultado = edicaoAgendamento.safeParse(requisicao.body)
    if (!resultado.success || !Object.keys(resultado.data).length) return resposta.code(400).send({ erro: 'Alterações inválidas' })
    const existente = await prisma.agendamento.findUnique({ where: { id } })
    if (!existente) return resposta.code(404).send({ erro: 'Agendamento não encontrado' })
    if (['CANCELADO', 'CONCLUIDO', 'NAO_COMPARECEU'].includes(existente.situacao)) {
      return resposta.code(409).send({ erro: 'Agendamento encerrado não pode ser alterado' })
    }
    const { situacao, ...alteracoes } = resultado.data
    if (situacao && !Object.keys(alteracoes).length) {
      const agendamento = await prisma.$transaction(async (transacao) => {
        const alterado = await transacao.agendamento.update({ where: { id }, data: { situacao } })
        await transacao.registroAuditoria.create({
          data: { usuarioId: requisicao.identidade!.id, acao: 'ALTERAR_SITUACAO', entidade: 'agendamento', entidadeId: id },
        })
        return alterado
      })
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
    } catch (erro) { return erroAgenda(erro, resposta) }
  })
}
