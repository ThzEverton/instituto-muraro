import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { criarAplicacao } from '../src/servidor.js'
import { prisma } from '../src/infraestrutura/banco-de-dados/prisma.js'
import { criarHashSenha } from '../src/compartilhado/seguranca/senhas.js'

const descrever = process.env.TESTAR_POSTGRES === '1' ? describe : describe.skip

descrever('persistência PostgreSQL e permissões', () => {
  const aplicacaoPromessa = criarAplicacao()
  const sufixo = randomUUID()
  const senha = 'SenhaSintetica123456!'
  let tokenAdministrador = ''
  let tokenFisioterapeuta = ''
  let pacienteId = ''

  afterAll(async () => {
    const aplicacao = await aplicacaoPromessa
    await aplicacao.close()
  })

  it('autentica usuário real e recusa senha inválida', async () => {
    await prisma.usuario.create({
      data: {
        nome: 'Administrador Sintético',
        email: `admin-${sufixo}@example.test`,
        senhaHash: await criarHashSenha(senha),
        perfil: 'ADMINISTRADOR',
      },
    })
    await prisma.usuario.create({
      data: {
        nome: 'Fisioterapeuta Sintético',
        email: `fisio-${sufixo}@example.test`,
        senhaHash: await criarHashSenha(senha),
        perfil: 'FISIOTERAPEUTA',
      },
    })
    const aplicacao = await aplicacaoPromessa
    const invalido = await aplicacao.inject({
      method: 'POST', url: '/api/v1/autenticacao/entrar',
      payload: { email: `admin-${sufixo}@example.test`, senha: 'errada' },
    })
    expect(invalido.statusCode).toBe(401)
    const valido = await aplicacao.inject({
      method: 'POST', url: '/api/v1/autenticacao/entrar',
      payload: { email: `admin-${sufixo}@example.test`, senha },
    })
    expect(valido.statusCode).toBe(200)
    tokenAdministrador = valido.json().dados.token
    const fisio = await aplicacao.inject({
      method: 'POST', url: '/api/v1/autenticacao/entrar',
      payload: { email: `fisio-${sufixo}@example.test`, senha },
    })
    tokenFisioterapeuta = fisio.json().dados.token
  })

  it('persiste cadastro e bloqueia acesso clínico à lista administrativa', async () => {
    const aplicacao = await aplicacaoPromessa
    const negado = await aplicacao.inject({
      method: 'GET', url: '/api/v1/pacientes',
      headers: { authorization: `Bearer ${tokenFisioterapeuta}` },
    })
    expect(negado.statusCode).toBe(403)
    const criado = await aplicacao.inject({
      method: 'POST', url: '/api/v1/pacientes',
      headers: { authorization: `Bearer ${tokenAdministrador}` },
      payload: { nomeCompleto: `Paciente Sintético ${sufixo}`, telefone: '11999999999' },
    })
    expect(criado.statusCode).toBe(201)
    pacienteId = criado.json().dados.id
    const banco = await prisma.paciente.findUnique({ where: { id: pacienteId } })
    expect(banco?.nomeCompleto).toContain('Paciente Sintético')
  })

  it('inativa sem apagar e revoga sessão no logout', async () => {
    const aplicacao = await aplicacaoPromessa
    const alterado = await aplicacao.inject({
      method: 'PATCH', url: `/api/v1/pacientes/${pacienteId}`,
      headers: { authorization: `Bearer ${tokenAdministrador}` },
      payload: { ativo: false },
    })
    expect(alterado.statusCode).toBe(200)
    expect((await prisma.paciente.findUnique({ where: { id: pacienteId } }))?.ativo).toBe(false)
    const saida = await aplicacao.inject({
      method: 'POST', url: '/api/v1/autenticacao/sair',
      headers: { authorization: `Bearer ${tokenAdministrador}` },
    })
    expect(saida.statusCode).toBe(200)
    const recusado = await aplicacao.inject({
      method: 'GET', url: '/api/v1/pacientes',
      headers: { authorization: `Bearer ${tokenAdministrador}` },
    })
    expect(recusado.statusCode).toBe(401)
  })
})
