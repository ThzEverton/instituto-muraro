import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { telefoneWhatsApp } from '../comunicacao/comunicacao.servico.js'
import { cadastroPaciente, consultaPacientes, edicaoPaciente } from './pacientes.validacao.js'

const perfisAdministrativos = ['ADMINISTRADOR', 'RECEPCAO'] as const

function dadosPaciente(valor: Record<string, unknown>) {
  const { dataNascimento, ...demais } = valor
  return {
    ...demais,
    ...('dataNascimento' in valor ? { dataNascimento: dataNascimento ? new Date(String(dataNascimento)) : null } : {}),
  }
}

export async function registrarRotasPacientes(aplicacao: FastifyInstance) {
  aplicacao.get('/api/v1/pacientes', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, async (requisicao, resposta) => {
    const validacao = consultaPacientes.safeParse(requisicao.query)
    if (!validacao.success) return resposta.code(400).send({ erro: 'Filtros inválidos' })
    const { busca, ativo, pagina, limite } = validacao.data
    const filtro: Prisma.PacienteWhereInput = {
      ...(ativo ? { ativo: ativo === 'true' } : {}),
      ...(busca ? { nomeCompleto: { contains: busca, mode: 'insensitive' } } : {}),
    }
    const [totalRegistros, dados] = await prisma.$transaction([
      prisma.paciente.count({ where: filtro }),
      prisma.paciente.findMany({
        where: filtro,
        orderBy: { nomeCompleto: 'asc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ])
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
  })

  aplicacao.post('/api/v1/pacientes', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const validacao = cadastroPaciente.safeParse(requisicao.body)
    if (!validacao.success) return resposta.code(400).send({ erro: 'Dados do paciente inválidos' })
    const paciente = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.paciente.create({ data: dadosPaciente(validacao.data) as Prisma.PacienteCreateInput })
      await transacao.registroAuditoria.create({
        data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'paciente', entidadeId: criado.id },
      })
      return criado
    })
    return resposta.code(201).send({ dados: paciente })
  })

  aplicacao.get('/api/v1/pacientes/:id', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, async (requisicao, resposta) => {
    const { id } = requisicao.params as { id: string }
    const paciente = await prisma.paciente.findUnique({ where: { id } })
    return paciente ? { dados: paciente } : resposta.code(404).send({ erro: 'Paciente não encontrado' })
  })

  aplicacao.patch('/api/v1/pacientes/:id', {
    preHandler: exigirPerfis([...perfisAdministrativos]),
  }, async (requisicao: RequisicaoAutenticada, resposta) => {
    const validacao = edicaoPaciente.safeParse(requisicao.body)
    if (!validacao.success || Object.keys(validacao.data).length === 0) {
      return resposta.code(400).send({ erro: 'Alterações inválidas' })
    }
    const { id } = requisicao.params as { id: string }
    const existente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } })
    if (!existente) return resposta.code(404).send({ erro: 'Paciente não encontrado' })
    const paciente = await prisma.$transaction(async (transacao) => {
      await transacao.$queryRaw`SELECT id FROM pacientes WHERE id = ${id} FOR UPDATE`
      const atual=await transacao.paciente.findUniqueOrThrow({where:{id}})
      const revogar=validacao.data.ativo===false || ('whatsapp' in validacao.data && telefoneWhatsApp(validacao.data.whatsapp??null)!==telefoneWhatsApp(atual.whatsapp))
      const alterado = await transacao.paciente.update({
        where: { id },
        data: { ...dadosPaciente(validacao.data), ...(revogar?{whatsappAutorizado:null,autorizadoWhatsAppEm:null}:{}) } as Prisma.PacienteUpdateInput,
      })
      await transacao.registroAuditoria.create({
        data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'paciente', entidadeId: id },
      })
      return alterado
    })
    return { dados: paciente }
  })
}
