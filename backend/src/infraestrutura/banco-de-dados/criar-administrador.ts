import { prisma } from './prisma.js'
import { criarHashSenha } from '../../compartilhado/seguranca/senhas.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error('Defina ADMIN_EMAIL válido para criar o administrador')
}

const partes: Buffer[] = []
for await (const parte of process.stdin) partes.push(Buffer.from(parte))
const senha = Buffer.concat(partes).toString('utf8').trimEnd()
if (senha.length < 14) throw new Error('Forneça senha de pelo menos 14 caracteres pela entrada padrão')

const existente = await prisma.usuario.findUnique({ where: { email } })
if (existente) throw new Error('Usuário já cadastrado')

await prisma.usuario.create({
  data: {
    nome: 'Administrador',
    email,
    senhaHash: await criarHashSenha(senha),
    perfil: 'ADMINISTRADOR',
  },
})
await prisma.$disconnect()
process.stdout.write('Administrador criado.\n')
