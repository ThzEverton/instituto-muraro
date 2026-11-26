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

  it('cria serie semanal atomica e respeita capacidade da sala', async () => {
    const aplicacao = await aplicacaoPromessa
    const headers = { authorization: 'Bearer ' + tokenAdministrador }
    const sala = await aplicacao.inject({ method: 'POST', url: '/api/v1/salas', headers, payload: { nome: 'Sala ' + sufixo, capacidade: 1 } })
    expect(sala.statusCode).toBe(201)
    const salaId = sala.json().dados.id
    const base = { pacienteId, profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda, salaId,
      inicioEm: '2026-11-30T08:00:00-03:00', fimEm: '2026-11-30T08:50:00-03:00' }
    const serie = await aplicacao.inject({ method: 'POST', url: '/api/v1/agendamentos/serie', headers, payload: { ...base, quantidade: 2, intervaloSemanas: 1 } })
    expect(serie.statusCode).toBe(201)
    expect(await prisma.agendamento.count({ where: { serieId: serie.json().dados.serieId } })).toBe(2)
    const outro = await prisma.paciente.create({ data: { nomeCompleto: 'Outro ' + sufixo } })
    const conflito = await aplicacao.inject({ method: 'POST', url: '/api/v1/agendamentos', headers, payload: { ...base, pacienteId: outro.id } })
    expect(conflito.statusCode).toBe(409)
    const recusada = await aplicacao.inject({ method: 'POST', url: '/api/v1/agendamentos/serie', headers, payload: {
      ...base, pacienteId: outro.id, inicioEm: '2026-11-23T08:00:00-03:00', fimEm: '2026-11-23T08:50:00-03:00', quantidade: 2, intervaloSemanas: 1
    } })
    expect(recusada.statusCode).toBe(409)
    expect(await prisma.agendamento.count({ where: { pacienteId: outro.id } })).toBe(0)
  })

  it('fecha a agenda em feriados e durante ferias', async () => {
    const aplicacao = await aplicacaoPromessa
    const headers = { authorization: 'Bearer ' + tokenAdministrador }
    const inicioEm = '2027-01-04T09:00:00-03:00'
    const fimEm = '2027-01-04T09:50:00-03:00'
    const url = '/api/v1/agenda/disponibilidade?' + new URLSearchParams({ profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda, inicioEm })
    const consultar = () => aplicacao.inject({ method: 'GET', url, headers })
    const ausencia = await aplicacao.inject({ method: 'POST', url: '/api/v1/agenda/ausencias', headers, payload: { profissionalId: null, dataInicio: '2027-01-04', dataFim: '2027-01-04', motivo: 'Feriado sintetico' } })
    expect(ausencia.statusCode).toBe(201)
    expect((await consultar()).json().dados.disponivel).toBe(false)
    const recusado = await aplicacao.inject({ method: 'POST', url: '/api/v1/agendamentos', headers, payload: { pacienteId, profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda, inicioEm, fimEm } })
    expect(recusado.statusCode).toBe(409)
    expect((await aplicacao.inject({ method: 'PATCH', url: '/api/v1/agenda/ausencias/' + ausencia.json().dados.id, headers })).statusCode).toBe(200)
    expect((await consultar()).json().dados.disponivel).toBe(true)
    const ferias = await aplicacao.inject({ method: 'POST', url: '/api/v1/agenda/ausencias', headers, payload: { profissionalId: profissionalIdAgenda, dataInicio: '2027-01-03', dataFim: '2027-01-09', motivo: 'Ferias sinteticas' } })
    expect(ferias.statusCode).toBe(201)
    expect((await consultar()).json().dados.disponivel).toBe(false)
    expect((await aplicacao.inject({ method: 'PATCH', url: '/api/v1/agenda/ausencias/' + ferias.json().dados.id, headers })).statusCode).toBe(200)
    expect((await consultar()).json().dados.disponivel).toBe(true)
  })

  it('restringe prontuario a vinculos e protege registros finalizados', async () => {
    const app = await aplicacaoPromessa
    const admin = { authorization: 'Bearer ' + tokenAdministrador }
    const fisio = { authorization: 'Bearer ' + tokenFisioterapeuta }
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: 'fisio-' + sufixo + '@example.test' } })
    const rota = '/api/v1/clinica/pacientes/' + pacienteId + '/prontuario'
    expect((await app.inject({ method: 'GET', url: rota, headers: fisio })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: rota, headers: admin })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: rota })).statusCode).toBe(401)
    const emailRecepcao = 'recepcao-' + sufixo + '@example.test'
    await prisma.usuario.create({ data: { nome: 'Recepcao sintetica', email: emailRecepcao, senhaHash: await criarHashSenha(senha), perfil: 'RECEPCAO' } })
    const loginRecepcao = await app.inject({ method: 'POST', url: '/api/v1/autenticacao/entrar', payload: { email: emailRecepcao, senha } })
    expect(loginRecepcao.statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: rota, headers: { authorization: 'Bearer ' + loginRecepcao.json().dados.token } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/api/v1/clinica/associacoes', headers: admin, payload: { profissionalId: profissionalIdAgenda, usuarioId: usuario.id } })).statusCode).toBe(201)
    const autorizar = (profissionalId: string, ativo: boolean) => app.inject({ method: 'POST', url: '/api/v1/clinica/vinculos', headers: admin, payload: { profissionalId, pacienteId, ativo } })
    expect((await autorizar(profissionalIdAgenda, true)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/v1/clinica/pacientes', headers: fisio })).json().dados.map((p: {id:string}) => p.id)).toContain(pacienteId)
    const criado = await app.inject({ method: 'POST', url: rota, headers: fisio, payload: { tipo: 'ANAMNESE', texto: 'Registro sintetico sem dados clinicos reais' } })
    expect(criado.statusCode).toBe(201)
    const entrada = criado.json().dados
    expect(entrada.situacao).toBe('RASCUNHO')
    const outroProf = await prisma.profissional.create({ data: { nome: 'Outro clinico ' + sufixo, especialidade: 'Fisioterapia' } })
    const email = 'outro-clinico-' + sufixo + '@example.test'
    const novaConta = await app.inject({ method: 'POST', url: '/api/v1/clinica/contas', headers: admin, payload: { profissionalId: outroProf.id, email, senha } })
    expect(novaConta.statusCode).toBe(201)
    expect(novaConta.json().dados.senhaHash).toBeUndefined()
    const login = await app.inject({ method: 'POST', url: '/api/v1/autenticacao/entrar', payload: { email, senha } })
    expect(login.statusCode).toBe(200)
    const outro = { authorization: 'Bearer ' + login.json().dados.token }
    expect((await autorizar(outroProf.id, true)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: rota, headers: outro })).json().dados.entradas).toHaveLength(0)
    const payload = { tipo: 'ANAMNESE', texto: 'Registro revisado sintetico', versao: entrada.versao, finalizar: true }
    const destino = rota + '/' + entrada.id
    expect((await app.inject({ method: 'PATCH', url: destino, headers: outro, payload })).statusCode).toBe(404)
    expect((await app.inject({ method: 'PATCH', url: destino, headers: fisio, payload })).statusCode).toBe(200)
    expect((await app.inject({ method: 'PATCH', url: destino, headers: fisio, payload })).statusCode).toBe(409)
    await expect(prisma.entradaProntuario.update({ where: { id: entrada.id }, data: { texto: 'Alteracao direta indevida' } })).rejects.toThrow()
    await expect(prisma.entradaProntuario.delete({ where: { id: entrada.id } })).rejects.toThrow()
    expect((await app.inject({ method: 'GET', url: rota, headers: outro })).json().dados.entradas[0].situacao).toBe('FINALIZADO')
    expect((await autorizar(profissionalIdAgenda, false)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: rota, headers: fisio })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: rota, headers: fisio, payload: { tipo: 'EVOLUCAO', texto: 'Nao autorizado' } })).statusCode).toBe(403)
    expect(await prisma.registroAuditoria.count({ where: { entidade: 'entrada_prontuario', entidadeId: entrada.id } })).toBe(2)
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
