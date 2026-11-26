import { randomBytes, scrypt as scryptOriginal, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptOriginal)

export async function criarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(32).toString('hex')
  const derivada = await scrypt(senha, sal, 64) as Buffer
  return `scrypt:${sal}:${derivada.toString('hex')}`
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const [algoritmo, sal, valor] = hash.split(':')
  if (algoritmo !== 'scrypt' || !sal || !valor || !/^[a-f0-9]{128}$/.test(valor)) return false
  const esperada = Buffer.from(valor, 'hex')
  const recebida = await scrypt(senha, sal, esperada.length) as Buffer
  return timingSafeEqual(esperada, recebida)
}
