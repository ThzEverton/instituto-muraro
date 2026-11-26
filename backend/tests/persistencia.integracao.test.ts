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
  let profissionalIdAgenda = ''
  let servicoIdAgenda = ''

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

  it('persiste profissionais, serviços, capacidade e vínculo entre eles', async () => {
    const aplicacao = await aplicacaoPromessa
    const cabecalhos = { authorization: `Bearer ${tokenAdministrador}` }
    const profissional = await aplicacao.inject({
      method: 'POST', url: '/api/v1/profissionais', headers: cabecalhos,
      payload: {
        nome: 'Profissional Sintético',
        especialidade: 'Fisioterapia',
        expedientes: [{ diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 }],
      },
    })
    expect(profissional.statusCode).toBe(201)
    const profissionalId = profissional.json().dados.id
    profissionalIdAgenda = profissionalId
    const servico = await aplicacao.inject({
      method: 'POST', url: '/api/v1/servicos', headers: cabecalhos,
      payload: {
        nome: 'Sessão Sintética', duracaoMinutos: 50, valorCentavos: 10000,
        capacidade: 3, profissionaisIds: [profissionalId],
      },
    })
    expect(servico.statusCode).toBe(201)
    const servicoId = servico.json().dados.id
    servicoIdAgenda = servicoId
    expect(servico.json().dados.capacidade).toBe(3)
    expect(await prisma.profissionalServico.count({
      where: { profissionalId, servicoId },
    })).toBe(1)
    const atualizado = await aplicacao.inject({
      method: 'PATCH', url: `/api/v1/profissionais/${profissionalId}`,
      headers: cabecalhos, payload: { servicosIds: [servicoId] },
    })
    expect(atualizado.statusCode).toBe(200)
    expect(atualizado.json().dados.servicos).toHaveLength(1)
    const negado = await aplicacao.inject({
      method: 'POST', url: '/api/v1/servicos',
      headers: { authorization: `Bearer ${tokenFisioterapeuta}` },
      payload: { nome: 'Bloqueado', duracaoMinutos: 50, valorCentavos: 1000 },
    })
    expect(negado.statusCode).toBe(403)
  })

  it('respeita a capacidade com agendamentos simultâneos', async () => {
    const aplicacao = await aplicacaoPromessa
    const pacientes = await Promise.all(Array.from({ length: 4 }, (_, indice) =>
      prisma.paciente.create({ data: { nomeCompleto: `Paciente Agenda ${sufixo} ${indice}` } })))
    const respostas = await Promise.all(pacientes.map((paciente) => aplicacao.inject({
      method: 'POST', url: '/api/v1/agendamentos',
      headers: { authorization: `Bearer ${tokenAdministrador}` },
      payload: {
        pacienteId: paciente.id,
        profissionalId: profissionalIdAgenda,
        servicoId: servicoIdAgenda,
        inicioEm: '2026-11-30T10:00:00-03:00',
        fimEm: '2026-11-30T10:50:00-03:00',
      },
    })))
    expect(respostas.filter((item) => item.statusCode === 201)).toHaveLength(3)
    expect(respostas.filter((item) => item.statusCode === 409)).toHaveLength(1)
  })

  it('bloqueia horario, consulta vagas e libera apos desbloqueio', async () => {
    const aplicacao = await aplicacaoPromessa
    const headers = { authorization: 'Bearer ' + tokenAdministrador }
    const inicioEm = '2026-11-30T08:00:00-03:00'
    const fimEm = '2026-11-30T08:50:00-03:00'
    const url = '/api/v1/agenda/disponibilidade?' + new URLSearchParams({ profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda, inicioEm })
    const consultar = () => aplicacao.inject({ method: 'GET', url, headers })
    expect((await consultar()).json().dados).toEqual({ disponivel: true, vagasRestantes: 3 })
    const criado = await aplicacao.inject({ method: 'POST', url: '/api/v1/agenda/bloqueios', headers, payload: { profissionalId: profissionalIdAgenda, inicioEm, fimEm, tipo: 'Teste sintetico' } })
    expect(criado.statusCode).toBe(201)
    expect((await consultar()).json().dados).toEqual({ disponivel: false, vagasRestantes: 0 })
    const recusado = await aplicacao.inject({ method: 'POST', url: '/api/v1/agendamentos', headers, payload: { pacienteId, profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda, inicioEm, fimEm } })
    expect(recusado.statusCode).toBe(409)
    const id = criado.json().dados.id
    expect((await aplicacao.inject({ method: 'PATCH', url: '/api/v1/agenda/bloqueios/' + id, headers })).statusCode).toBe(200)
    expect((await consultar()).json().dados).toEqual({ disponivel: true, vagasRestantes: 3 })
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
