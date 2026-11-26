import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { PerfilUsuario } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { verificarSenha } from '../../compartilhado/seguranca/senhas.js'
import { entradaAutenticacao } from './autenticacao.validacao.js'

export type Identidade = { id: string; perfil: PerfilUsuario }
export type RequisicaoAutenticada = FastifyRequest & { identidade?: Identidade; tokenHash?: string }

export function exigirPerfis(perfis: PerfilUsuario[]) {
  return async (requisicao: RequisicaoAutenticada, resposta: FastifyReply) => {
    const token = requisicao.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    if (!token) return resposta.code(401).send({ erro: 'Autenticação obrigatória' })
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const sessao = await prisma.sessaoUsuario.findUnique({
      where: { tokenHash },
      include: { usuario: { select: { id: true, perfil: true, ativo: true } } },
    })
    if (!sessao || sessao.revogadaEm || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) {
      return resposta.code(401).send({ erro: 'Sessão inválida ou expirada' })
    }
    if (!perfis.includes(sessao.usuario.perfil)) {
      return resposta.code(403).send({ erro: 'Permissão insuficiente' })
    }
    requisicao.identidade = { id: sessao.usuario.id, perfil: sessao.usuario.perfil }
    requisicao.tokenHash = tokenHash
  }
}

export async function registrarRotasAutenticacao(aplicacao: FastifyInstance) {
  aplicacao.post('/api/v1/autenticacao/entrar', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (requisicao, resposta) => {
    const validacao = entradaAutenticacao.safeParse(requisicao.body)
    if (!validacao.success) return resposta.code(400).send({ erro: 'Dados de entrada inválidos' })
    const usuario = await prisma.usuario.findUnique({ where: { email: validacao.data.email } })
    if (!usuario || !usuario.ativo || !await verificarSenha(validacao.data.senha, usuario.senhaHash)) {
      return resposta.code(401).send({ erro: 'Credenciais inválidas' })
    }
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiraEm = new Date(Date.now() + 8 * 60 * 60 * 1000)
    await prisma.sessaoUsuario.create({ data: { usuarioId: usuario.id, tokenHash, expiraEm } })
    return { dados: { usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, token, expiraEm } }
  })

  aplicacao.get('/api/v1/autenticacao/sessao', { preHandler: exigirPerfis(['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA']) }, async (req: RequisicaoAutenticada) => {
    return { dados: req.identidade }
  })
  aplicacao.post('/api/v1/autenticacao/sair', {
    preHandler: exigirPerfis(['ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA']),
  }, async (requisicao: RequisicaoAutenticada) => {
    await prisma.sessaoUsuario.update({ where: { tokenHash: requisicao.tokenHash! }, data: { revogadaEm: new Date() } })
    return { dados: { sessaoEncerrada: true } }
  })
}
