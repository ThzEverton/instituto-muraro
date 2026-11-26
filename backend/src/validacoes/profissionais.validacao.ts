import { z } from 'zod'

const expediente = z.object({
  diaSemana: z.number().int().min(0).max(6),
  inicioMinuto: z.number().int().min(0).max(1439),
  fimMinuto: z.number().int().min(1).max(1440),
}).refine((valor) => valor.fimMinuto > valor.inicioMinuto, 'Horário inválido')

export const cadastroProfissional = z.object({
  nome: z.string().trim().min(2).max(200),
  especialidade: z.string().trim().min(2).max(200),
  crefito: z.string().trim().min(3).max(50).optional(),
  telefone: z.string().trim().max(30).optional(),
  email: z.email().optional(),
  corAgenda: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  servicosIds: z.array(z.string().min(1)).default([]),
  expedientes: z.array(expediente).default([]),
}).strict().superRefine((dados, contexto) => {
  if (new Set(dados.servicosIds).size !== dados.servicosIds.length) {
    contexto.addIssue({ code: 'custom', message: 'Serviços duplicados' })
  }
  for (let indice = 0; indice < dados.expedientes.length; indice++) {
    const atual = dados.expedientes[indice]
    if (dados.expedientes.slice(0, indice).some((outro) =>
      outro.diaSemana === atual.diaSemana &&
      outro.inicioMinuto < atual.fimMinuto &&
      outro.fimMinuto > atual.inicioMinuto)) {
      contexto.addIssue({ code: 'custom', message: 'Expedientes sobrepostos' })
    }
  }
})

export const edicaoProfissional = z.object({
  nome: z.string().trim().min(2).max(200).optional(),
  especialidade: z.string().trim().min(2).max(200).optional(),
  crefito: z.string().trim().min(3).max(50).nullable().optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  corAgenda: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  servicosIds: z.array(z.string().min(1)).optional(),
  expedientes: z.array(expediente).optional(),
  ativo: z.boolean().optional(),
}).strict()
