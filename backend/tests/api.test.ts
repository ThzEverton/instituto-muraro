import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/server.js'
import { db } from '../src/store.js'
beforeEach(() => Object.values(db).forEach(items => items.splice(0)))
describe('API v1', () => {
  it('responde health', async () => { const r = await app.inject('/api/v1/health'); expect(r.statusCode).toBe(200); expect(JSON.parse(r.body).status).toBe('ok') })
  it('cria paciente e inativa sem apagar', async () => { const created = await app.inject({ method:'POST', url:'/api/v1/patients', payload:{ name:'Teste Clínico', phone:'11999999999' } }); expect(created.statusCode).toBe(201); const id = JSON.parse(created.body).id; const removed = await app.inject({ method:'DELETE', url:`/api/v1/patients/${id}` }); expect(JSON.parse(removed.body).data.active).toBe(false); expect(db.patients).toHaveLength(1) })
  it('recusa sobreposição de agenda', async () => { const input = { patientId:'p', professionalId:'prof', serviceId:'s', startsAt:'2026-10-23T10:00:00Z', endsAt:'2026-10-23T11:00:00Z' }; expect((await app.inject({method:'POST',url:'/api/v1/appointments',payload:input})).statusCode).toBe(201); expect((await app.inject({method:'POST',url:'/api/v1/appointments',payload:{...input, patientId:'p2'}})).statusCode).toBe(409) })
})
