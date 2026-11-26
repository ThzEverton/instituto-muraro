import type { Prisma } from '@prisma/client'
import { prisma } from '../configuracoes/banco-de-dados.js'

/** Acesso tipado a mensagemComunicacao; aceita a conexão da transação existente. */
export function repositorioMensagemComunicacao(conexao: Prisma.TransactionClient = prisma) {
  const entidade = conexao.mensagemComunicacao
  return {
    contar: entidade.count.bind(entidade),
    criarVarios: entidade.createMany.bind(entidade),
    listar: entidade.findMany.bind(entidade),
    buscarUnico: entidade.findUnique.bind(entidade),
    atualizarVarios: entidade.updateMany.bind(entidade),
  }
}
