import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

const pasta = (nome: string) => new URL('../src/' + nome + '/', import.meta.url)
const arquivos = (nome: string) => readdirSync(pasta(nome)).filter(f => f.endsWith('.ts')).map(f => ({
  nome: f, codigo: readFileSync(new URL(f, pasta(nome)), 'utf8'),
}))

describe('Arquitetura MVC horizontal', () => {
  it('mantém as rotas restritas ao registro, permissões e controladores', () => {
    for (const { nome, codigo } of arquivos('rotas')) {
      expect(codigo, nome).not.toMatch(/from\s+['\x22][^'\x22]*(?:@prisma\/client|repositorios\/|servicos\/)|\.safeParse\(|\.\$transaction\(/)
      expect(codigo, nome).toContain('controladores/')
    }
  })
  it('mantém controladores sem consultas ao banco e serviços sem Fastify', () => {
    for (const { nome, codigo } of arquivos('controladores')) {
      expect(codigo, nome).not.toMatch(/@prisma\/client|repositorios\/|configuracoes\/banco-de-dados/)
    }
    for (const { nome, codigo } of arquivos('servicos')) {
      expect(codigo, nome).not.toMatch(/from ['"]fastify['"]|FastifyReply|FastifyRequest|configuracoes\/banco-de-dados|\bprisma\.|\.\$queryRaw/)
    }
  })
})
