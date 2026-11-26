import { travarFormulario } from '../repositorios/transacao.repositorio.js'
import { travarAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioLinkFormulario } from '../repositorios/link-formulario.repositorio.js'
import { repositorioModeloFormulario } from '../repositorios/modelo-formulario.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioRespostaFormulario } from '../repositorios/resposta-formulario.repositorio.js'
import { repositorioServico } from '../repositorios/servico.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { modelo, edicao, publicacao, emissao, consultaPublica, envioPublico, validarRespostas, perguntas, consultaModelos, consultaLinks } from '../validacoes/formularios.validacao.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

class ErroFormulario extends Error { constructor(public status: number, mensagem: string) { super(mensagem) } }

function tratar(e: unknown) {
  if (e instanceof ErroFormulario) return retornarResultado(e.status, { erro: e.message })
  throw e
}

async function auditar(t: Prisma.TransactionClient, usuarioId: string, acao: string, entidade: string, entidadeId: string) {
  await repositorioRegistroAuditoria(t).criar({ data: { usuarioId, acao, entidade, entidadeId } })
}

async function travar(t: Prisma.TransactionClient, chave: string) {
  await travarFormulario(t, chave)
}

async function verificarServico(t: Prisma.TransactionClient, servicoId: string | null) {
  if (servicoId && !(await repositorioServico(t).buscarUnico({ where: { id: servicoId } }))?.ativo) throw new ErroFormulario(400, 'Servico inexistente ou inativo')
}

const selecaoLink = {
  id: true, modeloId: true, agendamentoId: true, criadoEm: true, expiraEm: true, revogadoEm: true,
  modelo: { select: { titulo: true, versao: true } },
  respostas: { select: { id: true, enviadaEm: true } },
} as const

async function localizar(t: Prisma.TransactionClient, token: string) {
  const item = await repositorioLinkFormulario(t).buscarUnico({ where: { tokenHash: hash(token) }, include: { modelo: true, agendamento: { include: { paciente: { select: { ativo: true } } } }, respostas: { select: { id: true } } } })
  if (!item || !item.pacienteId || item.revogadoEm || item.expiraEm <= new Date() || item.respostas.length ||
      item.modelo.situacao !== 'PUBLICADO' || !item.agendamento.paciente.ativo ||
      item.agendamento.pacienteId !== item.pacienteId || item.agendamento.profissionalId !== item.profissionalId || item.agendamento.servicoId !== item.servicoId ||
      ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'].includes(item.agendamento.situacao)) throw new ErroFormulario(410, 'Link indisponivel, expirado ou ja respondido')
  return item
}

export async function listarModelos(req: EntradaOperacao) {
    const q = consultaModelos.safeParse(req.consulta)
    if (!q.success) return retornarResultado(400, { erro: 'Consulta invalida' })
    if (q.data.publicados === 'false' && (req as EntradaOperacao).identidade?.perfil !== 'ADMINISTRADOR') return retornarResultado(403, { erro: 'Permissao insuficiente' })
    return { dados: await repositorioModeloFormulario().listar({ where: q.data.publicados === 'true' ? { situacao: 'PUBLICADO' } : {}, orderBy: [{ titulo: 'asc' },{ versao: 'desc' }], take: 500 }) }
}

export async function criarModelo(req: EntradaOperacao) {
    const v = modelo.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Modelo ou perguntas invalidas' })
    try {
      const dados = await emTransacao(async t => {
        await verificarServico(t, v.data.servicoId)
        const item = await repositorioModeloFormulario(t).criar({ data: { ...v.data, versao: 1 } })
        await auditar(t, req.identidade!.id, 'CRIAR_MODELO', 'modelo_formulario', item.id)
        return item
      })
      return retornarResultado(201, { dados })
    } catch(e) { return tratar(e) }
}

export async function atualizarModelo(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    const v = edicao.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Modelo invalido' })
    try {
      const dados = await emTransacao(async t => {
        await travar(t,id)
        await verificarServico(t,v.data.servicoId)
        const { revisao,...campos } = v.data
        const alterado = await repositorioModeloFormulario(t).atualizarVarios({ where: { id, situacao: 'RASCUNHO', revisao }, data: { ...campos, revisao: { increment: 1 } } })
        if (!alterado.count) throw new ErroFormulario(409, 'Modelo publicado ou revisao desatualizada')
        await auditar(t,req.identidade!.id,'EDITAR_MODELO','modelo_formulario',id)
        return repositorioModeloFormulario(t).buscarUnicoOuFalhar({ where: { id } })
      })
      return { dados }
    } catch(e) { return tratar(e) }
}

export async function publicarModelo(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    const v = publicacao.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Revisao invalida' })
    try {
      const dados = await emTransacao(async t => {
        await travar(t,id)
        const item = await repositorioModeloFormulario(t).buscarUnico({ where: { id } })
        if (!item || item.situacao !== 'RASCUNHO' || item.revisao !== v.data.revisao || !perguntas.safeParse(item.perguntas).success) throw new ErroFormulario(409,'Modelo invalido ou desatualizado')
        await verificarServico(t,item.servicoId)
        const publicado = await repositorioModeloFormulario(t).atualizar({ where: { id }, data: { situacao: 'PUBLICADO', publicadoEm: new Date() } })
        await auditar(t,req.identidade!.id,'PUBLICAR_MODELO','modelo_formulario',id)
        return publicado
      })
      return { dados }
    } catch(e) { return tratar(e) }
}

export async function criarVersaoModelo(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    try {
      const dados = await emTransacao(async t => {
        await travar(t,id)
        const item = await repositorioModeloFormulario(t).buscarUnico({ where: { id }, include: { proximaVersao: { select: { id: true } } } })
        if (!item || item.situacao !== 'PUBLICADO' || item.proximaVersao) throw new ErroFormulario(409,'Modelo nao permite nova versao')
        const lista = perguntas.parse(item.perguntas)
        const novo = await repositorioModeloFormulario(t).criar({ data: { titulo: item.titulo, perguntas: lista, servicoId: item.servicoId, versao: item.versao + 1, modeloAnteriorId: id } })
        await auditar(t,req.identidade!.id,'CRIAR_VERSAO','modelo_formulario',novo.id)
        return novo
      })
      return retornarResultado(201, { dados })
    } catch(e) { return tratar(e) }
}

export async function listarLinks(req: EntradaOperacao) {
    const q = consultaLinks.safeParse(req.consulta)
    if (!q.success) return retornarResultado(400, { erro: 'Selecione um atendimento' })
    const atendimento = await repositorioAgendamento().buscarUnico({ where: { id: q.data.agendamentoId }, select: { id: true, inicioEm: true, paciente: { select: { nomeCompleto: true } }, servico: { select: { id: true, nome: true } } } })
    if (!atendimento) return retornarResultado(404, { erro: 'Atendimento inexistente' })
    return { atendimento, dados: await repositorioLinkFormulario().listar({ where: { agendamentoId: q.data.agendamentoId }, select: selecaoLink, orderBy: { criadoEm: 'desc' }, take: 100 }) }
}

export async function emitirLink(req: EntradaOperacao) {
    const v = emissao.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro: 'Dados do link invalidos' })
    try {
      const token = randomBytes(32).toString('hex')
      const dados = await emTransacao(async t => {
        const { modeloId, agendamentoId, validadeHoras } = v.data
        await travar(t,agendamentoId + ':' + modeloId)
        const [m,a] = await Promise.all([repositorioModeloFormulario(t).buscarUnico({ where: { id: modeloId }, include: { proximaVersao: { select: { situacao: true } } } }),repositorioAgendamento(t).buscarUnico({ where: { id: agendamentoId }, include: { paciente: { select: { ativo: true } } } })])
        if (!m || m.situacao !== 'PUBLICADO' || m.proximaVersao?.situacao === 'PUBLICADO' || !perguntas.safeParse(m.perguntas).success || !a?.paciente.ativo || ['CANCELADO','CONCLUIDO','NAO_COMPARECEU'].includes(a.situacao) || (m.servicoId && m.servicoId !== a.servicoId)) throw new ErroFormulario(400,'Modelo ou atendimento indisponivel')
        const existentes = await repositorioLinkFormulario(t).listar({ where: { agendamentoId,modeloId,pacienteId:a.pacienteId,profissionalId:a.profissionalId,servicoId:a.servicoId }, select: { id: true, respostas: { select: { id: true } } }, orderBy: { id: 'asc' } })
        for (const anterior of existentes) await travar(t,anterior.id)
        if (await repositorioRespostaFormulario(t).contar({ where: { linkId: { in: existentes.map(e => e.id) } } })) throw new ErroFormulario(409,'Este modelo ja foi respondido para o atendimento')
        const revogados = await repositorioLinkFormulario(t).listar({ where: { id: { in: existentes.map(e => e.id) }, revogadoEm: null }, select: { id: true } })
        await repositorioLinkFormulario(t).atualizarVarios({ where: { id: { in: revogados.map(e => e.id) } }, data: { revogadoEm: new Date() } })
        for (const anterior of revogados) await auditar(t,req.identidade!.id,'REVOGAR_LINK','link_formulario',anterior.id)
        const item = await repositorioLinkFormulario(t).criar({ data: { modeloId,agendamentoId,pacienteId:a.pacienteId,profissionalId:a.profissionalId,servicoId:a.servicoId,tokenHash:hash(token),expiraEm:new Date(Date.now()+validadeHoras*3600000) }, select: selecaoLink })
        await auditar(t,req.identidade!.id,'EMITIR_LINK','link_formulario',item.id)
        return item
      })
      return retornarResultado(201, { dados: { ...dados, token } })
    } catch(e) { return tratar(e) }
}

export async function revogarLink(req: EntradaOperacao) {
    const { id } = req.parametros as { id: string }
    try {
      const dados = await emTransacao(async t => {
        await travar(t,id)
        const alterado = await repositorioLinkFormulario(t).atualizarVarios({ where: { id,revogadoEm:null,respostas:{none:{}} }, data: { revogadoEm:new Date() } })
        if (!alterado.count) throw new ErroFormulario(409,'Link inexistente, respondido ou revogado')
        await auditar(t,req.identidade!.id,'REVOGAR_LINK','link_formulario',id)
        return repositorioLinkFormulario(t).buscarUnicoOuFalhar({ where:{id},select:selecaoLink })
      })
      return { dados }
    } catch(e) { return tratar(e) }
}

export async function consultarFormularioPublico(req: EntradaOperacao) {
    const v = consultaPublica.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro:'Link invalido' })
    try {
      const item = await emTransacao(t => localizar(t,v.data.token))
      return { dados: { titulo:item.modelo.titulo, versao:item.modelo.versao, perguntas:item.modelo.perguntas } }
    } catch(e) { return tratar(e) }
}

export async function enviarFormularioPublico(req: EntradaOperacao) {
    const v = envioPublico.safeParse(req.corpo)
    if (!v.success) return retornarResultado(400, { erro:'Respostas invalidas' })
    try {
      await emTransacao(async t => {
        const inicial = await repositorioLinkFormulario(t).buscarUnico({ where:{tokenHash:hash(v.data.token)},select:{id:true} })
        if (!inicial) throw new ErroFormulario(410,'Link indisponivel')
        await travar(t,inicial.id)
        const item = await localizar(t,v.data.token)
        // Lock the mutable appointment while checking its identity and inserting the response.
        await travarAgendamento(t, item.agendamentoId)
        const conferido = await localizar(t,v.data.token)
        const respostas = validarRespostas(conferido.modelo.perguntas,v.data.respostas)
        if (!respostas) throw new ErroFormulario(400,'Confira os campos obrigatorios e os valores informados')
        await repositorioRespostaFormulario(t).criar({ data: { linkId:conferido.id,respostas } })
      })
      return retornarResultado(201, { dados:{ enviado:true } })
    } catch(e) { return tratar(e) }
}
