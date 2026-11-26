import { z } from 'zod'

const identificador = z.string().min(1).max(100)
export const vinculo = z.object({ pacienteId: identificador, profissionalId: identificador, ativo: z.boolean() }).strict()
export const conta = z.object({ profissionalId: identificador, email: z.email().max(254), senha: z.string().min(12).max(128) }).strict()
export const associacao = z.object({ profissionalId: identificador, usuarioId: identificador }).strict()
const tipos = z.enum(['ANAMNESE', 'AVALIACAO', 'EVOLUCAO', 'ADENDO'])
export const entrada = z.object({ tipo: tipos, texto: z.string().trim().min(1).max(30000) }).strict()
export const edicao = entrada.extend({ versao: z.number().int().positive(), finalizar: z.boolean().default(false) }).strict()
export const consultaVinculos = z.object({ profissionalId: identificador })
export const consultaPacientesClinicos = z.object({ busca: z.string().max(150).optional(), pagina: z.coerce.number().int().min(1).max(10000).default(1) })
