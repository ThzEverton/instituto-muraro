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
    const painelRecepcao=await app.inject({method:'GET',url:'/api/v1/painel/resumo',headers:{authorization:'Bearer '+loginRecepcao.json().dados.token},remoteAddress:'127.0.0.3'})
    expect(painelRecepcao.statusCode).toBe(200)
    expect(painelRecepcao.json().dados.financeiro).toBeNull()
    const painelAdmin=await app.inject({method:'GET',url:'/api/v1/painel/resumo',headers:admin,remoteAddress:'127.0.0.3'})
    expect(painelAdmin.statusCode).toBe(200)
    expect(painelAdmin.json().dados.financeiro).not.toBeNull()
    expect(painelAdmin.json().dados.pacientesAtivos).toBeGreaterThan(0)
    expect((await app.inject({method:'GET',url:'/api/v1/painel/resumo',headers:{authorization:'Bearer '+tokenFisioterapeuta},remoteAddress:'127.0.0.3'})).statusCode).toBe(403)
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

  it('publica modelos versionados e recebe pre-consulta de uso unico', async () => {
    const app = await aplicacaoPromessa
    const admin = { authorization: 'Bearer ' + tokenAdministrador }
    const fisio = { authorization: 'Bearer ' + tokenFisioterapeuta }
    const atendimento = await prisma.agendamento.findFirstOrThrow({ where: { pacienteId, profissionalId: profissionalIdAgenda, servicoId: servicoIdAgenda } })
    const payload = { titulo: 'Pre-consulta sintetica', servicoId: servicoIdAgenda, perguntas: [
      { id: 'motivo', rotulo: 'Motivo', tipo: 'TEXTO', obrigatoria: true },
      { id: 'sim', rotulo: 'Confirmacao', tipo: 'SIM_NAO', obrigatoria: true },
    ] }
    const modelo = await app.inject({ method: 'POST', url: '/api/v1/formularios/modelos', headers: admin, payload })
    expect(modelo.statusCode).toBe(201)
    const m = modelo.json().dados
    const publicar = (id: string, revisao: number) => app.inject({ method: 'POST', url: '/api/v1/formularios/modelos/' + id + '/publicar', headers: admin, payload: { revisao } })
    const emitir = (modeloId: string) => app.inject({ method: 'POST', url: '/api/v1/formularios/links', headers: admin, payload: { modeloId, agendamentoId: atendimento.id, validadeHoras: 48 } })
    expect((await emitir(m.id)).statusCode).toBe(400)
    expect((await publicar(m.id,m.revisao)).statusCode).toBe(200)
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/formularios/modelos/' + m.id, headers: admin, payload: { ...payload, revisao: m.revisao } })).statusCode).toBe(409)
    const anterior = await emitir(m.id)
    expect(anterior.statusCode).toBe(201)
    const atual = await emitir(m.id)
    expect(atual.statusCode).toBe(201)
    const token = atual.json().dados.token
    const consultar = (token: string) => app.inject({ method: 'POST', url: '/api/v1/formulario-publico/consultar', payload: { token } })
    const enviar = (respostas: object) => app.inject({ method: 'POST', url: '/api/v1/formulario-publico/enviar', payload: { token, respostas } })
    expect((await consultar(anterior.json().dados.token)).statusCode).toBe(410)
    const publico = await consultar(token)
    expect(publico.statusCode).toBe(200)
    expect(publico.json().dados.pacienteId).toBeUndefined()
    expect(publico.json().dados.perguntas).toHaveLength(2)
    expect((await enviar({ motivo: 'Teste' })).statusCode).toBe(400)
    expect((await enviar({ motivo: 'Teste', sim: 'false' })).statusCode).toBe(400)
    expect((await enviar({ motivo: 'Teste', sim: false, extra: 'indevido' })).statusCode).toBe(400)
    const resultados = await Promise.all([enviar({ motivo: 'Resposta sintetica', sim: false }), enviar({ motivo: 'Resposta sintetica', sim: false })])
    expect(resultados.map(r => r.statusCode).sort()).toEqual([201,410])
    expect((await consultar(token)).statusCode).toBe(410)
    expect((await emitir(m.id)).statusCode).toBe(409)
    const listagem = await app.inject({ method: 'GET', url: '/api/v1/formularios/links?agendamentoId=' + atendimento.id, headers: admin })
    expect(listagem.statusCode).toBe(200)
    expect(listagem.json().dados[0].tokenHash).toBeUndefined()
    expect(listagem.json().dados[0].respostas[0].respostas).toBeUndefined()
    const rota = '/api/v1/clinica/pacientes/' + pacienteId + '/prontuario'
    expect((await app.inject({ method: 'GET', url: rota, headers: fisio })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: rota, headers: admin })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/api/v1/clinica/vinculos', headers: admin, payload: { profissionalId: profissionalIdAgenda, pacienteId, ativo: true } })).statusCode).toBe(200)
    const prontuario = await app.inject({ method: 'GET', url: rota, headers: fisio })
    expect(prontuario.statusCode).toBe(200)
    expect(prontuario.json().dados.formularios[0].respostas.sim).toBe(false)
    const respostaId = prontuario.json().dados.formularios[0].id
    await expect(prisma.respostaFormulario.delete({ where: { id: respostaId } })).rejects.toThrow()
    await expect(prisma.modeloFormulario.update({ where: { id: m.id }, data: { titulo: 'Alteracao indevida' } })).rejects.toThrow()
    const nova = await app.inject({ method: 'POST', url: '/api/v1/formularios/modelos/' + m.id + '/versao', headers: admin, payload: {} })
    expect(nova.statusCode).toBe(201)
    expect(nova.json().dados.versao).toBe(2)
    expect((await publicar(nova.json().dados.id,1)).statusCode).toBe(200)
    const link2 = await emitir(nova.json().dados.id)
    expect(link2.statusCode).toBe(201)
    const token2 = link2.json().dados.token
    await prisma.linkFormulario.update({ where: { id: link2.json().dados.id }, data: { expiraEm: new Date(0) } })
    expect((await consultar(token2)).statusCode).toBe(410)
  })

  it('controla contratos, sessões, parcelas, taxas, recebimentos e repasses', async () => {
    const app=await aplicacaoPromessa
    const headers={authorization:'Bearer '+tokenAdministrador}
    const fisio={authorization:'Bearer '+tokenFisioterapeuta}
    const rota='/api/v1/financeiro/'
    const post=(url:string,payload:object)=>app.inject({method:'POST',url:rota+url,headers,payload})
    const patch=(url:string,payload:object)=>app.inject({method:'PATCH',url:rota+url,headers,payload})
    const get=(url:string)=>app.inject({method:'GET',url:rota+url,headers})
    const parceria=await post('parcerias',{nome:'Parceria '+sufixo,descontoPontosBase:1000})
    expect(parceria.statusCode).toBe(201)
    const plano=await post('planos',{nome:'Plano '+sufixo,servicoId:servicoIdAgenda,modalidade:'PACOTE',sessoes:1,valorCentavos:10001,validadeDias:60})
    expect(plano.statusCode).toBe(201)
    const planoId=plano.json().dados.id
    const atendimento=await prisma.agendamento.findFirstOrThrow({where:{pacienteId,profissionalId:profissionalIdAgenda,servicoId:servicoIdAgenda,situacao:{in:['AGENDADO','CONFIRMADO','AGUARDANDO_CONFIRMACAO','EM_ATENDIMENTO']}}})
    const dia=atendimento.inicioEm.toISOString().slice(0,10)
    const payload={chaveOperacao:randomUUID(),pacienteId,planoId,parceriaId:parceria.json().dados.id,inicioEm:dia,primeiroVencimento:dia,quantidadeParcelas:3}
    const criado=await post('contratos',payload)
    expect(criado.statusCode).toBe(201)
    const c=criado.json().dados
    expect(c.valorFinalCentavos).toBe(9001)
    expect(c.cobrancas.map((b:{valorCentavos:number})=>b.valorCentavos)).toEqual([3001,3000,3000])
    expect((await post('contratos',payload)).statusCode).toBe(409)
    expect((await patch('planos/'+planoId,{valorCentavos:20000})).statusCode).toBe(200)
    expect((await prisma.contratoPlano.findUniqueOrThrow({where:{id:c.id}})).valorFinalCentavos).toBe(9001)
    expect((await post('consumos',{contratoId:c.id,agendamentoId:atendimento.id})).statusCode).toBe(400)
    expect((await app.inject({method:'PATCH',url:'/api/v1/agendamentos/'+atendimento.id,headers,payload:{situacao:'CONCLUIDO'}})).statusCode).toBe(200)
    expect((await post('consumos',{contratoId:c.id,agendamentoId:atendimento.id})).statusCode).toBe(201)
    expect((await post('consumos',{contratoId:c.id,agendamentoId:atendimento.id})).statusCode).toBe(409)
    expect((await get('contratos?pacienteId='+pacienteId)).json().dados[0].sessoesRestantes).toBe(0)
    const taxa=await post('taxas',{formaPagamento:'CREDITO',parcelas:3,pontosBase:350})
    expect(taxa.statusCode).toBe(201)
    const taxaId=taxa.json().dados.id
    const b=c.cobrancas[0].id
    const receber=(valorCentavos:number)=>post('cobrancas/'+b+'/recebimentos',{chaveOperacao:randomUUID(),valorCentavos,formaPagamento:'CREDITO',parcelas:3,taxaId})
    const duplicados=await Promise.all([receber(2000),receber(2000)])
    expect(duplicados.map(r=>r.statusCode).sort()).toEqual([201,409])
    const r=duplicados.find(r=>r.statusCode===201)!.json().dados
    expect(r.taxaCentavos).toBe(70)
    expect((await post('taxas',{formaPagamento:'CREDITO',parcelas:3,pontosBase:500})).statusCode).toBe(201)
    expect((await prisma.recebimento.findUniqueOrThrow({where:{id:r.id}})).taxaCentavos).toBe(70)
    await expect(prisma.taxaPagamento.update({where:{id:taxaId},data:{pontosBase:99}})).rejects.toThrow()
    const comissao=await post('comissoes',{recebimentoId:r.id,profissionalId:profissionalIdAgenda,pontosBase:2000})
    expect(comissao.statusCode).toBe(201)
    expect(comissao.json().dados.valorCentavos).toBe(386)
    expect((await patch('recebimentos/'+r.id+'/estornar',{motivo:'Correção fictícia'})).statusCode).toBe(200)
    expect((await prisma.comissao.findUniqueOrThrow({where:{id:comissao.json().dados.id}})).canceladaEm).not.toBeNull()
    const integral=await receber(3001)
    expect(integral.statusCode).toBe(201)
    const r2=integral.json().dados
    const repasse=await post('comissoes',{recebimentoId:r2.id,profissionalId:profissionalIdAgenda,pontosBase:2000})
    expect(repasse.statusCode).toBe(201)
    expect((await patch('comissoes/'+repasse.json().dados.id+'/pagar',{})).statusCode).toBe(200)
    expect((await patch('recebimentos/'+r2.id+'/estornar',{motivo:'Correção fictícia'})).statusCode).toBe(409)
    const lista=(await get('cobrancas?pacienteId='+pacienteId)).json().dados
    expect(lista.find((item:{id:string})=>item.id===b).saldoCentavos).toBe(0)
    expect(lista.find((item:{id:string})=>item.id===b).situacao).toBe('PAGA')
    const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const antes=(await get('relatorio?inicio='+hoje+'&fim='+hoje)).json().dados
    const despesa=await post('despesas',{chaveOperacao:randomUUID(),descricao:'Despesa fictícia',categoria:'Material',valorCentavos:1000,ocorridaEm:hoje})
    expect(despesa.statusCode).toBe(201)
    const depois=(await get('relatorio?inicio='+hoje+'&fim='+hoje)).json().dados
    expect(depois.saldoCentavos).toBe(antes.saldoCentavos-1000)
    expect((await patch('despesas/'+despesa.json().dados.id+'/estornar',{motivo:'Correção fictícia'})).statusCode).toBe(200)
    expect((await get('relatorio?inicio='+hoje+'&fim='+hoje)).json().dados.saldoCentavos).toBe(antes.saldoCentavos)
    expect((await app.inject({method:'GET',url:rota+'relatorio?inicio='+hoje+'&fim='+hoje,headers:fisio})).statusCode).toBe(403)
    const inicioNovo=new Date(Date.parse(c.fimEm)+86400000).toISOString().slice(0,10)
    const novo=await post('contratos',{...payload,chaveOperacao:randomUUID(),renovacaoDeId:c.id,inicioEm:inicioNovo,primeiroVencimento:inicioNovo})
    expect(novo.statusCode).toBe(201)
    expect(novo.json().dados.valorFinalCentavos).toBe(18000)
    expect((await post('contratos',{...payload,chaveOperacao:randomUUID(),renovacaoDeId:c.id,inicioEm:inicioNovo,primeiroVencimento:inicioNovo})).statusCode).toBe(409)
  })

  it('gera fila sem duplicar e exige autorização de contato vigente', async () => {
    const app=await aplicacaoPromessa
    const headers={authorization:'Bearer '+tokenAdministrador}
    const rota='/api/v1/comunicacao/'
    const post=(url:string,payload:object={})=>app.inject({remoteAddress:'127.0.0.2',method:'POST',url:rota+url,headers,payload})
    const patch=(url:string,payload:object={})=>app.inject({remoteAddress:'127.0.0.2',method:'PATCH',url:rota+url,headers,payload})
    expect((await patch('regras/CONFIRMACAO_AGENDA',{ativa:true,antecedenciaDias:3,mensagem:'Olá {nome}, confirme {data} às {hora}.'})).statusCode).toBe(200)
    expect((await app.inject({remoteAddress:'127.0.0.2',method:'PATCH',url:'/api/v1/pacientes/'+pacienteId,headers,payload:{whatsapp:'11900000000'}})).statusCode).toBe(200)
    const inicio=new Date(Date.now()+86400000)
    const ag=await prisma.agendamento.create({data:{pacienteId,profissionalId:profissionalIdAgenda,servicoId:servicoIdAgenda,inicioEm:inicio,fimEm:new Date(inicio.getTime()+3600000)}})
    const itens=()=>prisma.mensagemComunicacao.findMany({where:{referenciaId:ag.id,tipo:'CONFIRMACAO_AGENDA'}})
    expect((await post('gerar')).statusCode).toBe(200)
    expect(await itens()).toHaveLength(0)
    expect((await patch('pacientes/'+pacienteId+'/autorizacao',{aceita:true})).statusCode).toBe(200)
    expect((await post('gerar')).statusCode).toBe(200)
    expect((await post('gerar')).statusCode).toBe(200)
    const fila=await itens()
    expect(fila).toHaveLength(1)
    const id=fila[0].id
    const preparada=await post('fila/'+id+'/preparar')
    expect(preparada.statusCode).toBe(200)
    expect(preparada.json().dados.telefone).toBe('5511900000000')
    expect(preparada.json().dados.mensagem).toContain('confirme')
    expect((await app.inject({remoteAddress:'127.0.0.2',method:'PATCH',url:'/api/v1/pacientes/'+pacienteId,headers,payload:{whatsapp:'11900000001'}})).statusCode).toBe(200)
    expect((await post('fila/'+id+'/preparar')).statusCode).toBe(409)
    expect((await patch('pacientes/'+pacienteId+'/autorizacao',{aceita:true})).statusCode).toBe(200)
    expect((await post('fila/'+id+'/preparar')).json().dados.telefone).toBe('5511900000001')
    expect((await patch('fila/'+id+'/enviada')).statusCode).toBe(200)
    expect((await patch('fila/'+id+'/enviada')).statusCode).toBe(409)
    expect((await post('gerar')).statusCode).toBe(200)
    expect(await itens()).toHaveLength(1)
    expect((await itens())[0].situacao).toBe('ENVIADA_MANUALMENTE')
    await patch('pacientes/'+pacienteId+'/autorizacao',{aceita:false})
    await patch('regras/CONFIRMACAO_AGENDA',{ativa:false,antecedenciaDias:3,mensagem:'Olá {nome}, confirme {data} às {hora}.'})
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
