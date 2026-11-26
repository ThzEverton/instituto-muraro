import { z } from 'zod'

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, digito, indice) =>
      total + Number(digito) * (tamanho + 1 - indice), 0)
    const verificador = (soma * 10) % 11
    if (Number(cpf[tamanho]) !== (verificador === 10 ? 0 : verificador)) return false
  }
  return true
}

export const cadastroPaciente = z.object({
  nomeCompleto: z.string().trim().min(2).max(200),
  cpf: z.string().refine(cpfValido, 'CPF inválido').optional(),
  dataNascimento: z.iso.date().optional(),
  telefone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  email: z.email().optional(),
  endereco: z.string().trim().max(500).optional(),
  responsavelLegal: z.string().trim().max(200).optional(),
  contatoEmergencia: z.string().trim().max(200).optional(),
  observacoesAdministrativas: z.string().trim().max(2000).optional(),
  formaAtendimento: z.string().trim().max(100).optional(),
}).strict()

export const edicaoPaciente = cadastroPaciente.partial().extend({
  cpf: z.union([z.string().refine(cpfValido, 'CPF inválido'), z.null()]).optional(),
  dataNascimento: z.union([z.iso.date(), z.null()]).optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  whatsapp: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  endereco: z.string().trim().max(500).nullable().optional(),
  responsavelLegal: z.string().trim().max(200).nullable().optional(),
  contatoEmergencia: z.string().trim().max(200).nullable().optional(),
  observacoesAdministrativas: z.string().trim().max(2000).nullable().optional(),
  formaAtendimento: z.string().trim().max(100).nullable().optional(),
  ativo: z.boolean().optional(),
})

export const consultaPacientes = z.object({
  busca: z.string().trim().max(200).optional(),
  ativo: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
})
