import { z } from 'zod'

const camposAgendamento = z.object({
  pacienteId: z.string().min(1),
  profissionalId: z.string().min(1),
  servicoId: z.string().min(1),
  salaId: z.string().min(1).nullable().optional(),
  inicioEm: z.iso.datetime({ offset: true }),
  fimEm: z.iso.datetime({ offset: true }),
}).strict()

export const entradaAgendamento = camposAgendamento.refine((dados) => new Date(dados.fimEm) > new Date(dados.inicioEm), 'Intervalo inválido')

export const entradaSerie = camposAgendamento.extend({
  quantidade: z.number().int().min(2).max(52),
  intervaloSemanas: z.number().int().min(1).max(4),
}).refine((dados) => new Date(dados.fimEm) > new Date(dados.inicioEm), 'Intervalo invalido')

export const entradaSala = z.object({
  nome: z.string().trim().min(2).max(100),
  capacidade: z.number().int().min(1).max(100),
  ativo: z.boolean().optional(),
}).strict()

export const edicaoAgendamento = camposAgendamento.partial().extend({
  situacao: z.enum([
    'AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO',
    'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU',
  ]).optional(),
})

export const consultaAgenda = z.object({
  inicioEm: z.iso.datetime({ offset: true }),
  fimEm: z.iso.datetime({ offset: true }),
  profissionalId: z.string().optional(),
  servicoId: z.string().optional(),
}).refine((dados) => new Date(dados.fimEm) > new Date(dados.inicioEm), 'Intervalo inválido')

export function dataLocal(data: Date, fuso = 'America/Sao_Paulo') {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(data)
  const campo = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(campo('weekday'))
  return {
    data: `${campo('year')}-${campo('month')}-${campo('day')}`,
    diaSemana: dia,
    minuto: Number(campo('hour')) * 60 + Number(campo('minute')),
  }
}

export const entradaBloqueio = z.object({
  profissionalId: z.string().min(1),
  inicioEm: z.iso.datetime({ offset: true }),
  fimEm: z.iso.datetime({ offset: true }),
  tipo: z.string().trim().min(2).max(100),
  recorrente: z.literal(false).optional(),
}).strict().refine((dados) => new Date(dados.fimEm) > new Date(dados.inicioEm), 'Intervalo inválido')

export const consultaDisponibilidade = z.object({
  salaId: z.string().min(1).optional(),
  profissionalId: z.string().min(1),
  servicoId: z.string().min(1),
  inicioEm: z.iso.datetime({ offset: true }),
})


export const entradaAusencia = z.object({
  profissionalId: z.string().min(1).nullable(),
  dataInicio: z.iso.date(),
  dataFim: z.iso.date(),
  motivo: z.string().trim().min(2).max(100),
}).strict().refine(d => {
  const dias = (Date.parse(d.dataFim) - Date.parse(d.dataInicio)) / 86400000
  return dias >= 0 && dias <= 90
}, 'Periodo invalido ou superior a 91 dias')

export function diasDoPeriodo(dataInicio: string, dataFim: string) {
  const dias: string[] = []
  for (let dia = Date.parse(dataInicio); dia <= Date.parse(dataFim); dia += 86400000) {
    dias.push(new Date(dia).toISOString().slice(0, 10))
  }
  return dias
}

// Converte meia-noite civil em Sao Paulo, inclusive se houver mudanca de offset.
export function inicioDiaLocal(dia: string) {
  const alvo = Date.parse(dia + 'T00:00:00Z')
  let instante = alvo
  for (let i = 0; i < 3; i++) {
    const local = dataLocal(new Date(instante))
    const representado = Date.parse(local.data + 'T00:00:00Z') + local.minuto * 60000
    instante += alvo - representado
  }
  return new Date(instante)
}

export function diaSeguinte(dia: string) {
  return new Date(Date.parse(dia) + 86400000).toISOString().slice(0, 10)
}
