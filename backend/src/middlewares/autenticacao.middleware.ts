import { repositorioSessaoUsuario } from '../repositorios/sessao-usuario.repositorio.js'
import { createHash } from 'node:crypto'
import type { FastifyReply } from 'fastify'
import type { PerfilUsuario } from '@prisma/client'
import type { RequisicaoAutenticada } from '../tipos/requisicao.js'
export function exigirPerfis(perfis: PerfilUsuario[]) {
  return async (requisicao: RequisicaoAutenticada, resposta: FastifyReply) => {
    const token = requisicao.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    if (!token) return resposta.code(401).send({ erro: 'Autenticação obrigatória' })
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const sessao = await repositorioSessaoUsuario().buscarUnico({
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
