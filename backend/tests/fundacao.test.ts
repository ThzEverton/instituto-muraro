import { describe, expect, it } from 'vitest'
import { criarHashSenha, verificarSenha } from '../src/compartilhado/seguranca/senhas.js'
import { cadastroPaciente, consultaPacientes } from '../src/modulos/pacientes/pacientes.validacao.js'
import { cadastroProfissional } from '../src/modulos/profissionais/profissionais.validacao.js'
import { cadastroServico } from '../src/modulos/servicos/servicos.validacao.js'

describe('fundação em português', () => {
  it('gera hash com sal e valida a senha sem guardar texto puro', async () => {
    const primeiro = await criarHashSenha('SenhaSegura123456')
    const segundo = await criarHashSenha('SenhaSegura123456')
    expect(primeiro).not.toBe(segundo)
    expect(primeiro).not.toContain('SenhaSegura123456')
    expect(await verificarSenha('SenhaSegura123456', primeiro)).toBe(true)
    expect(await verificarSenha('senha-incorreta', primeiro)).toBe(false)
    expect(await verificarSenha('qualquer', 'hash-inválido')).toBe(false)
  })

  it('rejeita CPF, email e campos desconhecidos inválidos', () => {
    expect(cadastroPaciente.safeParse({ nomeCompleto: 'Ana Souza', cpf: '123', email: 'invalido' }).success).toBe(false)
    expect(cadastroPaciente.safeParse({ nomeCompleto: 'Ana Souza', perfil: 'ADMINISTRADOR' }).success).toBe(false)
    expect(cadastroPaciente.safeParse({ nomeCompleto: 'Ana Souza', cpf: '52998224725' }).success).toBe(true)
    expect(cadastroPaciente.safeParse({ nomeCompleto: 'Ana Souza', cpf: '11111111111' }).success).toBe(false)
  })

  it('limita paginação de pacientes', () => {
    expect(consultaPacientes.parse({ pagina: '2', limite: '20' })).toMatchObject({ pagina: 2, limite: 20 })
    expect(consultaPacientes.safeParse({ limite: '1000' }).success).toBe(false)
  })

  it('rejeita expediente sobreposto e capacidade inválida', () => {
    expect(cadastroProfissional.safeParse({
      nome: 'Profissional Sintético', especialidade: 'Fisioterapia',
      expedientes: [
        { diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 },
        { diaSemana: 1, inicioMinuto: 700, fimMinuto: 900 },
      ],
    }).success).toBe(false)
    expect(cadastroServico.safeParse({
      nome: 'Pilates Sintético', duracaoMinutos: 50, valorCentavos: 10000, capacidade: 0,
    }).success).toBe(false)
  })
})
