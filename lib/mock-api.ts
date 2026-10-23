export type Patient = { id: number; name: string; phone: string; status: string }
export type Service = { id: number; name: string; duration: number; price: number; active: boolean }
export type Appointment = { id: number; time: string; date?: string; patient: string; professional: string; service: string; status: string; duration?: number }
export type CalendarBlock = { id: number; type: string; professional: string; start: string; end: string; recurring: boolean }
export type Questionnaire = { id: number; title: string; type: string; version: number; status: string; questions: number; responses: number }

export const seedPatients: Patient[] = [
  { id: 1, name: 'Maria Oliveira', phone: '(11) 99821-4432', status: 'Ativo' },
  { id: 2, name: 'João Pedro Santos', phone: '(11) 99120-8855', status: 'Ativo' },
  { id: 3, name: 'Camila Ferreira', phone: '(11) 99700-1122', status: 'Ativo' },
  { id: 4, name: 'Lucas Almeida', phone: '(11) 98810-2344', status: 'Pendente' },
]
export const seedServices: Service[] = [
  { id: 1, name: 'Consulta individual', duration: 50, price: 280, active: true },
  { id: 2, name: 'Avaliação psicológica', duration: 90, price: 450, active: true },
  { id: 3, name: 'Terapia infantil', duration: 50, price: 300, active: true },
]
export const seedAppointments: Appointment[] = [
  { id: 1, time: '08:30', date: '2026-10-23', patient: 'Maria Oliveira', professional: 'Dra. Ana Oliveira', service: 'Consulta individual', status: 'Confirmado' },
  { id: 2, time: '10:00', date: '2026-10-23', patient: 'João Pedro Santos', professional: 'Dr. Rafael Muraro', service: 'Avaliação psicológica', status: 'Agendado' },
  { id: 3, time: '13:30', date: '2026-10-23', patient: 'Camila Ferreira', professional: 'Dra. Ana Oliveira', service: 'Consulta individual', status: 'Confirmado' },
  { id: 4, time: '15:00', date: '2026-10-23', patient: 'Lucas Almeida', professional: 'Dra. Beatriz Lima', service: 'Terapia infantil', status: 'Aguardando' },
]
export const seedBlocks: CalendarBlock[] = [{ id: 1, type: 'Almoço', professional: 'Dra. Ana Oliveira', start: '2026-10-23T12:00', end: '2026-10-23T13:00', recurring: true }]
export const seedQuestionnaires: Questionnaire[] = [{ id: 1, title: 'Anamnese inicial', type: 'Pré-consulta', version: 1, status: 'Publicado', questions: 8, responses: 12 }, { id: 2, title: 'Avaliação psicológica', type: 'Clínico', version: 2, status: 'Rascunho', questions: 14, responses: 0 }]

export async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api${path}`, init); if (!response.ok) throw new Error('Não foi possível concluir a operação'); return response.json() }
