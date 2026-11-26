import { repositorioProfissional } from '../repositorios/profissional.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioServico } from '../repositorios/servico.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma } from '@prisma/client'
import { consultaCadastros } from '../validacoes/consulta-cadastros.js'
import { cadastroServico, edicaoServico } from '../validacoes/servicos.validacao.js'

const inclusao = { profissionais: { select: { profissionalId: true } } } as const

async function profissionaisValidos(ids: string[]) {
  if (!ids.length) return true
  return await repositorioProfissional().contar({ where: { id: { in: ids }, ativo: true } }) === ids.length
}

export async function listarServicos(requisicao: EntradaOperacao) {
    const resultado = consultaCadastros.safeParse(requisicao.consulta)
    if (!resultado.success) return retornarResultado(400, { erro: 'Filtros inválidos' })
    const { busca, ativo, pagina, limite } = resultado.data
    const filtro: Prisma.ServicoWhereInput = {
      ...(ativo ? { ativo: ativo === 'true' } : {}),
      ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
    }
    const [totalRegistros, dados] = await emTransacao([
      repositorioServico().contar({ where: filtro }),
      repositorioServico().listar({ where: filtro, include: inclusao, orderBy: { nome: 'asc' }, skip: (pagina - 1) * limite, take: limite }),
    ])
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
}

export async function criarServico(requisicao: EntradaOperacao) {
    const resultado = cadastroServico.safeParse(requisicao.corpo)
    if (!resultado.success) return retornarResultado(400, { erro: 'Dados do serviço inválidos' })
    const { profissionaisIds, ...dados } = resultado.data
    if (!await profissionaisValidos(profissionaisIds)) return retornarResultado(400, { erro: 'Profissional inexistente ou inativo' })
    const servico = await emTransacao(async (transacao) => {
      const criado = await repositorioServico(transacao).criar({
        data: { ...dados, profissionais: { create: profissionaisIds.map((profissionalId) => ({ profissionalId })) } },
        include: inclusao,
      })
      await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'servico', entidadeId: criado.id } })
      return criado
    })
    return retornarResultado(201, { dados: servico })
}

export async function buscarServico(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const servico = await repositorioServico().buscarUnico({ where: { id }, include: inclusao })
    return servico ? { dados: servico } : retornarResultado(404, { erro: 'Serviço não encontrado' })
}

export async function atualizarServico(requisicao: EntradaOperacao) {
    const resultado = edicaoServico.safeParse(requisicao.corpo)
    if (!resultado.success || !Object.keys(resultado.data).length) return retornarResultado(400, { erro: 'Alterações inválidas' })
    const { id } = requisicao.parametros as { id: string }
    const existente = await repositorioServico().buscarUnico({ where: { id }, select: { id: true } })
    if (!existente) return retornarResultado(404, { erro: 'Serviço não encontrado' })
    const { profissionaisIds, ...dados } = resultado.data
    if (profissionaisIds && !await profissionaisValidos(profissionaisIds)) return retornarResultado(400, { erro: 'Profissional inexistente ou inativo' })
    const servico = await emTransacao(async (transacao) => {
      const alterado = await repositorioServico(transacao).atualizar({
        where: { id },
        data: {
          ...dados,
          ...(profissionaisIds ? { profissionais: { deleteMany: {}, create: profissionaisIds.map((profissionalId) => ({ profissionalId })) } } : {}),
        },
        include: inclusao,
      })
      await repositorioRegistroAuditoria(transacao).criar({ data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'servico', entidadeId: id } })
      return alterado
    })
    return { dados: servico }
}
