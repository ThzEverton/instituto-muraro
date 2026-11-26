import { repositorioUsuario } from '../repositorios/usuario.repositorio.js'
import { prisma } from '../configuracoes/banco-de-dados.js'
import { criarHashSenha } from './senhas.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error('Defina ADMIN_EMAIL válido para criar o administrador')
}

const partes: Buffer[] = []
for await (const parte of process.stdin) partes.push(Buffer.from(parte))
const senha = Buffer.concat(partes).toString('utf8').trimEnd()
if (senha.length < 14) throw new Error('Forneça senha de pelo menos 14 caracteres pela entrada padrão')

const existente = await repositorioUsuario().buscarUnico({ where: { email } })
if (existente) throw new Error('Usuário já cadastrado')

await repositorioUsuario().criar({
  data: {
    nome: 'Administrador',
    email,
    senhaHash: await criarHashSenha(senha),
    perfil: 'ADMINISTRADOR',
  },
})
await prisma.$disconnect()
process.stdout.write('Administrador criado.\n')
