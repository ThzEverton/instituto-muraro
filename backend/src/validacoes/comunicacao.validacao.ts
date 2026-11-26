import { z } from 'zod'
export const tipo=z.enum(['CONFIRMACAO_AGENDA','LEMBRETE_AGENDA','COBRANCA','RENOVACAO'])
export const regra=z.object({ativa:z.boolean(),antecedenciaDias:z.number().int().min(0).max(30),mensagem:z.string().trim().min(5).max(600).refine(t=>!Array.from(t.matchAll(/\{([^}]+)\}/g)).some(m=>!['nome','data','hora','clinica'].includes(m[1])),'Variavel nao permitida')}).strict()
export const autorizacao=z.object({aceita:z.boolean()}).strict()
export const consulta=z.object({situacao:z.enum(['PENDENTE','ENVIADA_MANUALMENTE','CANCELADA']).default('PENDENTE'),pagina:z.coerce.number().int().min(1).max(10000).default(1)})
export const gerar=z.object({}).strict()
