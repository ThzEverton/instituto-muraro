import { z } from 'zod'

export const consultaCadastros = z.object({
  busca: z.string().trim().max(200).optional(),
  ativo: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
})
