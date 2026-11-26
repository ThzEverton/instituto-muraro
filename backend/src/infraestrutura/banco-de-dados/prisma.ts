import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  // Erros são tratados pelo servidor sem registrar argumentos ou conteúdo clínico.
  log: [],
})
