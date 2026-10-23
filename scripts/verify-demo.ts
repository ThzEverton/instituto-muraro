import assert from 'node:assert/strict'
import { initialDb, dateISO, blocked, hasConflict, chargePaid, chargeStatus, money } from '../lib/physio-model'

const db=initialDb()
assert.equal(db.patients.length,4,'Quatro pacientes sintéticos')
assert.equal(db.therapists.length,3,'Três fisioterapeutas sintéticos')
assert.ok(db.therapists.every(t=>t.crefito.includes('CREFITO')),'Registro profissional específico de fisioterapia')
assert.ok(db.services.every(s=>!s.name.toLowerCase().includes('psicol')),'Serviços sem psicologia')
assert.ok(db.appointments.every(a=>db.patients.some(p=>p.id===a.patientId)&&db.therapists.some(t=>t.id===a.therapistId)&&db.services.some(s=>s.id===a.serviceId)),'Agendamentos com vínculos válidos')
assert.ok(db.appointments.every(a=>db.services.find(s=>s.id===a.serviceId)?.therapistIds.includes(a.therapistId)),'Profissional habilitado por serviço')
assert.equal(hasConflict(db,{...db.appointments[0],id:'novo'},undefined),'Este profissional já tem um atendimento nesse intervalo.','Não duplicar intervalos na agenda')
let weekday=dateISO()
for(let i=0;i<7;i++){const w=new Date(weekday+'T12:00:00').getDay();if(w>0&&w<6)break;weekday=dateISO(i+1)}
assert.equal(blocked(db.blocks[0],weekday,'12:15',30,'t1'),true,'Intervalo de almoço bloqueado')
assert.equal(chargePaid(db.charges[0]),30000,'Pagamento parcial permanece vinculado')
assert.equal(chargeStatus(db.charges[0]),'Parcial','Status derivado dos pagamentos')
assert.ok(money(14000).includes('140'),'Moeda em BRL')
console.log('OK: fixtures de fisioterapia, vínculos, conflito de agenda, bloqueios e financeiro.')
