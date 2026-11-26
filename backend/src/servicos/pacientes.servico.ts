import { travarPaciente as travarRegistroPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioPaciente, listarPacientesPaginados } from '../repositorios/paciente.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma } from '@prisma/client'
import { telefoneWhatsApp } from './comunicacao.servico.js'
import { cadastroPaciente, consultaPacientes, edicaoPaciente } from '../validacoes/pacientes.validacao.js'

function dadosPaciente(valor: Record<string, unknown>) {
  const { dataNascimento, ...demais } = valor
  return {
    ...demais,
    ...('dataNascimento' in valor ? { dataNascimento: dataNascimento ? new Date(String(dataNascimento)) : null } : {}),
  }
}

export async function listarPacientes(requisicao: EntradaOperacao) {
    const validacao = consultaPacientes.safeParse(requisicao.consulta)
    if (!validacao.success) return retornarResultado(400, { erro: 'Filtros inválidos' })
    const { pagina, limite } = validacao.data
    const [totalRegistros, dados] = await listarPacientesPaginados(validacao.data)
    return { dados, paginacao: { pagina, totalRegistros, totalPaginas: Math.ceil(totalRegistros / limite) } }
}

export async function criarPaciente(requisicao: EntradaOperacao) {
    const validacao = cadastroPaciente.safeParse(requisicao.corpo)
    if (!validacao.success) return retornarResultado(400, { erro: 'Dados do paciente inválidos' })
    const paciente = await emTransacao(async (transacao) => {
      const criado = await repositorioPaciente(transacao).criar({ data: dadosPaciente(validacao.data) as Prisma.PacienteCreateInput })
      await repositorioRegistroAuditoria(transacao).criar({
        data: { usuarioId: requisicao.identidade!.id, acao: 'CRIAR', entidade: 'paciente', entidadeId: criado.id },
      })
      return criado
    })
    return retornarResultado(201, { dados: paciente })
}

export async function buscarPaciente(requisicao: EntradaOperacao) {
    const { id } = requisicao.parametros as { id: string }
    const paciente = await repositorioPaciente().buscarUnico({ where: { id } })
    return paciente ? { dados: paciente } : retornarResultado(404, { erro: 'Paciente não encontrado' })
}

export async function atualizarPaciente(requisicao: EntradaOperacao) {
    const validacao = edicaoPaciente.safeParse(requisicao.corpo)
    if (!validacao.success || Object.keys(validacao.data).length === 0) {
      return retornarResultado(400, { erro: 'Alterações inválidas' })
    }
    const { id } = requisicao.parametros as { id: string }
    const existente = await repositorioPaciente().buscarUnico({ where: { id }, select: { id: true } })
    if (!existente) return retornarResultado(404, { erro: 'Paciente não encontrado' })
    const paciente = await emTransacao(async (transacao) => {
      await travarRegistroPaciente(transacao, id)
      const atual=await repositorioPaciente(transacao).buscarUnicoOuFalhar({where:{id}})
      const revogar=validacao.data.ativo===false || ('whatsapp' in validacao.data && telefoneWhatsApp(validacao.data.whatsapp??null)!==telefoneWhatsApp(atual.whatsapp))
      const alterado = await repositorioPaciente(transacao).atualizar({
        where: { id },
        data: { ...dadosPaciente(validacao.data), ...(revogar?{whatsappAutorizado:null,autorizadoWhatsAppEm:null}:{}) } as Prisma.PacienteUpdateInput,
      })
      await repositorioRegistroAuditoria(transacao).criar({
        data: { usuarioId: requisicao.identidade!.id, acao: 'ATUALIZAR', entidade: 'paciente', entidadeId: id },
      })
      return alterado
    })
    return { dados: paciente }
}
