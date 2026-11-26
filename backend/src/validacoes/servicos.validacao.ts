import { z } from 'zod'

export const cadastroServico = z.object({
  nome: z.string().trim().min(2).max(200),
  categoria: z.string().trim().max(100).optional(),
  descricao: z.string().trim().max(2000).optional(),
  duracaoMinutos: z.number().int().min(10).max(480),
  valorCentavos: z.number().int().min(0),
  capacidade: z.number().int().min(1).max(100).default(1),
  profissionaisIds: z.array(z.string().min(1)).default([]),
}).strict().refine((dados) => new Set(dados.profissionaisIds).size === dados.profissionaisIds.length, 'Profissionais duplicados')

export const edicaoServico = z.object({
  nome: z.string().trim().min(2).max(200).optional(),
  categoria: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  duracaoMinutos: z.number().int().min(10).max(480).optional(),
  valorCentavos: z.number().int().min(0).optional(),
  capacidade: z.number().int().min(1).max(100).optional(),
  profissionaisIds: z.array(z.string().min(1)).optional(),
  ativo: z.boolean().optional(),
}).strict()
