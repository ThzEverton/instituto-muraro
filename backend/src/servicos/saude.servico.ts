import { verificarConexao } from '../repositorios/saude.repositorio.js'
import { resultado } from '../tipos/operacao.js'

export async function consultarSaude() {
  try {
    await verificarConexao()
    return { situacao: 'operacional' }
  } catch {
    return resultado(503, { situacao: 'banco indisponível' })
  }
}
