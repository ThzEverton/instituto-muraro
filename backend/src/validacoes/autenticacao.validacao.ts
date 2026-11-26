import { z } from 'zod'

export const entradaAutenticacao = z.object({
  email: z.email().transform((valor) => valor.trim().toLowerCase()),
  senha: z.string().min(1),
}).strict()
