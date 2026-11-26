import { gerarFilaComunicacao } from '../servicos/comunicacao.servico.js'
import { prisma } from '../configuracoes/banco-de-dados.js'

try {
  const resultado = await gerarFilaComunicacao()
  console.log(JSON.stringify(resultado))
} catch {
  console.error('Falha ao gerar fila de comunicação')
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
