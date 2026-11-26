import { repositorioProfissional } from '../repositorios/profissional.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioServico } from '../repositorios/servico.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma } from '@prisma/client'
import { consultaCadastros } from '../validacoes/consulta-cadastros.js'
import { cadastroProfissional, edicaoProfissional } from '../validacoes/profissionais.validacao.js'

const inclusao = {
  servicos: { select: { servicoId: true } },
  expedientes: { select: { id: true, diaSemana: true, inicioMinuto: true, fimMinuto: true } },
} as const

async function servicosValidos(ids: string[]) {
  if (!ids.length) return true
  return await repositorioServico().contar({ where: { id: { in: ids }, ativo: true } }) === ids.length
}

export async function listarProfissionais(requisicao: EntradaOperacao) {
    const resultado = consultaCadastros.safeParse(requisicao.consulta)
    if (!resultado.success) return retornarResultado(400, { erro: 'Filtros inválidos' })
    const { busca, ativo, pagina, limite } = resultado.data
    const filtro: Prisma.ProfissionalWhereInput = {
      ...(ativo ? { ativo: ativo === 'true' } : {}),
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    }
    const [totalRegistros, dados] = await emTransacao([
      repositorioProfissional().contar({ where: filtro }),
      repositorioProfissional().listar({ where: filtro, include: inclusao, orderBy: { nome: 'asc' }, skip: (pagina - 1) * limite, take: limite }),
    ])
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
}

export async function criarProfissional(requisicao: EntradaOperacao) {
    const resultado = cadastroProfissional.safeParse(requisicao.corpo)
    if (!resultado.success) return retornarResultado(400, { erro: 'Dados do profissional inválidos' })
    const { servicosIds, expedientes, ...dados } = resultado.data
    if (!await servicosValidos(servicosIds)) return retornarResultado(400, { erro: 'Serviço inexistente ou inativo' })
    const profissional = await emTransacao(async (transacao) => {
      const criado = await repositorioProfissional(transacao).criar({
        data: {
          ...dados,
          servicos: { create: servicosIds.map((servicoId) => ({ servicoId })) },
          expedientes: { create: expedientes },
        },
        include: inclusao,
      })
      await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'profissional', entidadeId: criado.id } })
      return criado
    })
    return retornarResultado(201, { dados: profissional })
}

export async function buscarProfissional(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const profissional = await repositorioProfissional().buscarUnico({ where: { id }, include: inclusao })
    return profissional ? { dados: profissional } : retornarResultado(404, { erro: 'Profissional não encontrado' })
}

export async function atualizarProfissional(requisicao: EntradaOperacao) {
    const resultado = edicaoProfissional.safeParse(requisicao.corpo)
    if (!resultado.success || !Object.keys(resultado.data).length) return retornarResultado(400, { erro: 'Alterações inválidas' })
    const { id } = requisicao.parametros as { id: string }
    const existente = await repositorioProfissional().buscarUnico({ where: { id }, select: { id: true } })
    if (!existente) return retornarResultado(404, { erro: 'Profissional não encontrado' })
    const { servicosIds, expedientes, ...dados } = resultado.data
    if (servicosIds && !await servicosValidos(servicosIds)) return retornarResultado(400, { erro: 'Serviço inexistente ou inativo' })
    const profissional = await emTransacao(async (transacao) => {
      const alterado = await repositorioProfissional(transacao).atualizar({
        where: { id },
        data: {
          ...dados,
          ...(servicosIds ? { servicos: { deleteMany: {}, create: servicosIds.map((servicoId) => ({ servicoId })) } } : {}),
          ...(expedientes ? { expedientes: { deleteMany: {}, create: expedientes } } : {}),
        },
        include: inclusao,
      })
      await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'profissional', entidadeId: id } })
      return alterado
    })
    return { dados: profissional }
}
