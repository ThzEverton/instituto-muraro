import { repositorioSessaoUsuario } from '../repositorios/sessao-usuario.repositorio.js'
import { repositorioUsuario } from '../repositorios/usuario.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { createHash, randomBytes } from 'node:crypto'
import { verificarSenha } from '../utilitarios/senhas.js'
import { entradaAutenticacao } from '../validacoes/autenticacao.validacao.js'



export async function entrar(requisicao: EntradaOperacao) {
    const validacao = entradaAutenticacao.safeParse(requisicao.corpo)
    if (!validacao.success) return retornarResultado(400, { erro: 'Dados de entrada inválidos' })
    const usuario = await repositorioUsuario().buscarUnico({ where: { email: validacao.data.email } })
    if (!usuario || !usuario.ativo || !await verificarSenha(validacao.data.senha, usuario.senhaHash)) {
      return retornarResultado(401, { erro: 'Credenciais inválidas' })
    }
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiraEm = new Date(Date.now() + 8 * 60 * 60 * 1000)
    await repositorioSessaoUsuario().criar({ data: { usuarioId: usuario.id, tokenHash, expiraEm } })
    return { dados: { usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, token, expiraEm } }
}

export async function consultarSessao(req: EntradaOperacao) {
    return { dados: req.identidade }
}

export async function sair(requisicao: EntradaOperacao) {
    await repositorioSessaoUsuario().atualizar({ where: { tokenHash: requisicao.tokenHash! }, data: { revogadaEm: new Date() } })
    return { dados: { sessaoEncerrada: true } }
}
