import { z } from 'zod'

export const id = z.string().min(1).max(100)
const pergunta = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  rotulo: z.string().trim().min(1).max(300),
  tipo: z.enum(['TEXTO', 'TEXTO_LONGO', 'NUMERO', 'ESCOLHA', 'SIM_NAO', 'DATA']),
  obrigatoria: z.boolean(),
  opcoes: z.array(z.string().trim().min(1).max(150)).max(30).optional(),
}).strict().superRefine((p, c) => {
  if (p.tipo === 'ESCOLHA' && (!p.opcoes || p.opcoes.length < 2 || new Set(p.opcoes).size !== p.opcoes.length)) c.addIssue({ code: 'custom', message: 'Escolha exige ao menos duas opcoes distintas' })
  if (p.tipo !== 'ESCOLHA' && p.opcoes?.length) c.addIssue({ code: 'custom', message: 'Opcoes nao permitidas neste tipo' })
})
export const perguntas = z.array(pergunta).min(1).max(60).refine(p => new Set(p.map(q => q.id)).size === p.length, 'Identificadores repetidos')
export const modelo = z.object({ titulo: z.string().trim().min(2).max(180), servicoId: id.nullable(), perguntas }).strict()
export const edicao = modelo.extend({ revisao: z.number().int().positive() }).strict()
export const publicacao = z.object({ revisao: z.number().int().positive() }).strict()
export const emissao = z.object({ modeloId: id, agendamentoId: id, validadeHoras: z.number().int().min(1).max(168) }).strict()
const token = z.string().regex(/^[a-f0-9]{64}$/)
export const consultaPublica = z.object({ token }).strict()
export const envioPublico = consultaPublica.extend({ respostas: z.record(z.string().max(80), z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.null()])) }).strict()
export function validarRespostas(definicao: unknown, valores: Record<string, string | number | boolean | null>) {
  const lista = perguntas.safeParse(definicao)
  if (!lista.success) return null
  if (Object.keys(valores).some(k => !lista.data.some(p => p.id === k))) return null
  const respostas: Record<string, string | number | boolean | null> = Object.create(null)
  for (const p of lista.data) {
    let v = Object.hasOwn(valores, p.id) ? valores[p.id] : null
    if (typeof v === 'string') v = v.trim()
    if (v === null || v === '') { if (p.obrigatoria) return null; respostas[p.id] = null; continue }
    if (p.tipo === 'TEXTO' && (typeof v !== 'string' || v.length > 500)) return null
    if (p.tipo === 'TEXTO_LONGO' && typeof v !== 'string') return null
    if (p.tipo === 'NUMERO' && typeof v !== 'number') return null
    if (p.tipo === 'ESCOLHA' && (typeof v !== 'string' || !p.opcoes?.includes(v))) return null
    if (p.tipo === 'SIM_NAO' && typeof v !== 'boolean') return null
    if (p.tipo === 'DATA' && !z.iso.date().safeParse(v).success) return null
    respostas[p.id] = v
  }
  return respostas
}

export const consultaModelos = z.object({ publicados: z.enum(['true','false']).default('true') })
export const consultaLinks = z.object({ agendamentoId: id })
