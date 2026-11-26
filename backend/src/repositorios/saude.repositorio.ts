import { prisma } from '../configuracoes/banco-de-dados.js'

export async function verificarConexao() {
  await prisma.$queryRaw`SELECT 1`
}
