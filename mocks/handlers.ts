import { http, HttpResponse } from 'msw'
import { seedAppointments, seedPatients, seedServices } from '@/lib/mock-api'

export const handlers = [
  http.get('/api/patients', () => HttpResponse.json(seedPatients)),
  http.get('/api/appointments', () => HttpResponse.json(seedAppointments)),
  http.get('/api/services', () => HttpResponse.json(seedServices)),
  http.post('/api/patients', async ({ request }) => HttpResponse.json({ id: Date.now(), ...(await request.json() as object) }, { status: 201 })),
  http.post('/api/appointments', async ({ request }) => HttpResponse.json({ id: Date.now(), ...(await request.json() as object) }, { status: 201 })),
  http.post('/api/services', async ({ request }) => HttpResponse.json({ id: Date.now(), ...(await request.json() as object) }, { status: 201 })),
]
