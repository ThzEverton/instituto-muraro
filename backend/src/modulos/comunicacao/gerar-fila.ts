import { gerarFilaComunicacao } from './comunicacao.servico.js'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'

try {
  const resultado = await gerarFilaComunicacao()
  console.log(JSON.stringify(resultado))
} catch {
  console.error('Falha ao gerar fila de comunicação')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
