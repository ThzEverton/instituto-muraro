export type AppointmentStatus = 'Agendado' | 'Confirmado' | 'Em atendimento' | 'Concluído' | 'Cancelado' | 'Não compareceu'
export type PlanStatus = 'Ativo' | 'Concluído' | 'Pausado'
export type EvaluationStatus = 'Rascunho' | 'Finalizada'
export type Role = 'ADMIN' | 'RECEPTION' | 'PROFESSIONAL'
export type Patient = { id:string; name:string; birthDate:string; cpf:string; phone:string; email:string; address:string; emergencyName:string; emergencyPhone:string; insurance:string; adminNotes:string; active:boolean; createdAt:string }
export type Therapist = { id:string; name:string; crefito:string; specialty:string; phone:string; email:string; color:string; workdays:string; active:boolean }
export type ClinicService = { id:string; name:string; category:string; duration:number; priceCents:number; therapistIds:string[]; description:string; active:boolean }
export type Appointment = { id:string; patientId:string; therapistId:string; serviceId:string; date:string; time:string; status:AppointmentStatus; note:string }
export type CalendarBlock = { id:string; therapistId:string; date:string; endDate:string; start:string; end:string; reason:string; recurring:boolean }
export type Assessment = { id:string; patientId:string; therapistId:string; date:string; complaint:string; history:string; pain:number; limitations:string; findings:string; goals:string; status:EvaluationStatus }
export type TherapyPlan = { id:string; patientId:string; therapistId:string; startDate:string; goal:string; approach:string; sessionsPlanned:number; sessionsCompleted:number; weeklyFrequency:number; status:PlanStatus }
export type Addendum = { id:string; date:string; text:string }
export type Evolution = { id:string; patientId:string; therapistId:string; date:string; treatment:string; response:string; instructions:string; painBefore:number; painAfter:number; status:EvaluationStatus; addenda:Addendum[] }
export type Payment = { id:string; date:string; amountCents:number; method:string; reversedAt?:string }
export type Charge = { id:string; patientId:string; description:string; amountCents:number; dueDate:string; payments:Payment[]; active:boolean }
export type Expense = { id:string; description:string; category:string; amountCents:number; date:string; active:boolean }
export type User = { id:string; name:string; email:string; role:Role; therapistId:string; active:boolean }
export type TemplateQuestion = { id:string; label:string; kind:'Texto'|'Texto longo'|'Número'|'Data'|'Seleção'|'Sim/Não'; required:boolean; options:string }
export type Template = { id:string; name:string; version:number; status:'Rascunho'|'Publicado'; questions:TemplateQuestion[]; active:boolean }
export type ClinicConfig = { name:string; phone:string; address:string; whatsappText:string }
export type DemoDb = { patients:Patient[]; therapists:Therapist[]; services:ClinicService[]; appointments:Appointment[]; blocks:CalendarBlock[]; assessments:Assessment[]; plans:TherapyPlan[]; evolutions:Evolution[]; charges:Charge[]; expenses:Expense[]; users:User[]; templates:Template[]; config:ClinicConfig }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const dateISO = (offset=0) => { const d=new Date(); d.setDate(d.getDate()+offset); const y=d.getFullYear(); return String(y)+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
export const money = (cents:number) => (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export const fmtDate = (value:string) => { if(!value) return '—'; const bits=value.slice(0,10).split('-'); return bits.length===3 ? bits.reverse().join('/') : value }
export const cleanDigits = (value:string) => String(value||'').replace(/\D/g,'')
export const maskPhone = (value:string) => { const d=cleanDigits(value).slice(0,11); if(d.length<=2)return d; if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2); if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6); return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7) }
export const maskCpf = (value:string) => {const d=cleanDigits(value).slice(0,11);return d.length===11 ? d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9) : d}
export const diffMinutes = (time:string) => {const n=time.split(':').map(Number);return n[0]*60+n[1]}
export const plusMinutes = (time:string,minutes:number) => {const n=diffMinutes(time)+minutes;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
export const chargePaid = (charge:Charge) => charge.payments.filter(p=>!p.reversedAt).reduce((sum,p)=>sum+p.amountCents,0)
export const chargeStatus = (charge:Charge) => {if(!charge.active)return 'Cancelada';const balance=charge.amountCents-chargePaid(charge);return balance<=0?'Paga':balance<charge.amountCents?'Parcial':charge.dueDate<dateISO()?'Vencida':'Pendente'}
export const patientAge = (birth:string) => {if(!birth)return '—';const d=new Date(birth+'T12:00:00');const today=new Date();let age=today.getFullYear()-d.getFullYear();if(today.getMonth()<d.getMonth()||(today.getMonth()===d.getMonth()&&today.getDate()<d.getDate()))age--;return age>=0&&age<130?age+' anos':'—'}

export function blocked(block:CalendarBlock,date:string,time:string,duration:number,therapistId:string){
 if(block.therapistId!==therapistId)return false
 if(block.recurring){if(date<block.date || date>block.endDate)return false;const day=new Date(date+'T12:00:00').getDay();if(day===0 || day===6)return false}
 else if(block.date!==date)return false
 return diffMinutes(time)<diffMinutes(block.end)&&diffMinutes(time)+duration>diffMinutes(block.start)
}
export function hasConflict(db:DemoDb, proposal:Appointment,ignoreId?:string){
 const service=db.services.find(x=>x.id===proposal.serviceId);const duration=service?.duration||50
 if(diffMinutes(proposal.time)+duration>24*60)return 'Horário ultrapassa o fim do dia.'
 if(db.blocks.some(b=>blocked(b,proposal.date,proposal.time,duration,proposal.therapistId)))return 'Profissional indisponível por bloqueio ou intervalo.'
 const overlap=db.appointments.some(a=>a.id!==ignoreId&&a.therapistId===proposal.therapistId&&a.date===proposal.date&&!['Cancelado','Não compareceu'].includes(a.status)&&diffMinutes(proposal.time)<diffMinutes(a.time)+(db.services.find(s=>s.id===a.serviceId)?.duration||50)&&diffMinutes(proposal.time)+duration>diffMinutes(a.time))
 return overlap?'Este profissional já tem um atendimento nesse intervalo.':null
}
export const initialDb = ():DemoDb=>({
 patients:[
 {id:'p1',name:'Marina Costa · exemplo',birthDate:'1988-04-16',cpf:'',phone:'(18) 99999-0101',email:'marina.exemplo@example.com',address:'Presidente Epitácio/SP',emergencyName:'Contato demonstrativo',emergencyPhone:'(18) 99999-0131',insurance:'Particular',adminNotes:'Cadastro fictício para demonstração.',active:true,createdAt:dateISO(-45)},
 {id:'p2',name:'Rafael Mendes · exemplo',birthDate:'1994-08-22',cpf:'',phone:'(18) 99999-0102',email:'rafael.exemplo@example.com',address:'Presidente Epitácio/SP',emergencyName:'',emergencyPhone:'',insurance:'Particular',adminNotes:'',active:true,createdAt:dateISO(-30)},
 {id:'p3',name:'Clara Barbosa · exemplo',birthDate:'1962-11-02',cpf:'',phone:'(18) 99999-0103',email:'clara.exemplo@example.com',address:'Presidente Epitácio/SP',emergencyName:'',emergencyPhone:'',insurance:'Convênio - exemplo',adminNotes:'',active:true,createdAt:dateISO(-16)},
 {id:'p4',name:'Lucas Rocha · exemplo',birthDate:'2001-06-14',cpf:'',phone:'(18) 99999-0104',email:'lucas.exemplo@example.com',address:'Presidente Epitácio/SP',emergencyName:'',emergencyPhone:'',insurance:'Particular',adminNotes:'',active:true,createdAt:dateISO(-7)}
 ],
 therapists:[
 {id:'t1',name:'Dra. Helena Martins · exemplo',crefito:'CREFITO DEMO-001',specialty:'Fisioterapia ortopédica',phone:'(18) 99999-0201',email:'helena@example.com',color:'#2B668F',workdays:'Seg–Sex · 08h–17h',active:true},
 {id:'t2',name:'Dr. André Ribeiro · exemplo',crefito:'CREFITO DEMO-002',specialty:'Fisioterapia esportiva',phone:'(18) 99999-0202',email:'andre@example.com',color:'#3C897D',workdays:'Seg–Sex · 09h–18h',active:true},
 {id:'t3',name:'Dra. Beatriz Lima · exemplo',crefito:'CREFITO DEMO-003',specialty:'Fisioterapia neurológica',phone:'(18) 99999-0203',email:'beatriz@example.com',color:'#B88652',workdays:'Seg–Qui · 08h–16h',active:true}
 ],
 services:[
 {id:'s1',name:'Avaliação fisioterapêutica',category:'Avaliação',duration:60,priceCents:18000,therapistIds:['t1','t2','t3'],description:'Avaliação funcional e definição de conduta.',active:true},
 {id:'s2',name:'Sessão de fisioterapia individual',category:'Sessão',duration:50,priceCents:14000,therapistIds:['t1','t2','t3'],description:'Atendimento individualizado.',active:true},
 {id:'s3',name:'Reabilitação esportiva',category:'Reabilitação',duration:60,priceCents:16000,therapistIds:['t2'],description:'Prevenção e reabilitação funcional no esporte.',active:true},
 {id:'s4',name:'Pilates terapêutico',category:'Terapia',duration:50,priceCents:12000,therapistIds:['t1','t3'],description:'Exercícios supervisionados com finalidade terapêutica.',active:true},
 ],
 appointments:[
 {id:'a1',patientId:'p1',therapistId:'t1',serviceId:'s2',date:dateISO(),time:'08:30',status:'Confirmado',note:'Demonstração.'},
 {id:'a2',patientId:'p2',therapistId:'t2',serviceId:'s1',date:dateISO(),time:'10:00',status:'Agendado',note:''},
 {id:'a3',patientId:'p3',therapistId:'t3',serviceId:'s2',date:dateISO(),time:'13:30',status:'Concluído',note:''},
 {id:'a4',patientId:'p4',therapistId:'t2',serviceId:'s3',date:dateISO(1),time:'15:00',status:'Agendado',note:''},
 {id:'a5',patientId:'p1',therapistId:'t1',serviceId:'s2',date:dateISO(3),time:'09:00',status:'Agendado',note:''},
 ],
 blocks:[
 {id:'b1',therapistId:'t1',date:dateISO(-7),endDate:dateISO(60),start:'12:00',end:'13:00',reason:'Intervalo de almoço',recurring:true},
 {id:'b2',therapistId:'t2',date:dateISO(-7),endDate:dateISO(60),start:'12:30',end:'13:30',reason:'Intervalo de almoço',recurring:true}
 ],
 assessments:[
 {id:'v1',patientId:'p1',therapistId:'t1',date:dateISO(-10),complaint:'Desconforto lombar — registro fictício.',history:'Sintomas apresentados apenas para demonstrar o formulário.',pain:4,limitations:'Flexão de tronco e permanência prolongada sentada.',findings:'Exemplo de avaliação funcional.',goals:'Melhora da mobilidade e função.',status:'Finalizada'},
 {id:'v2',patientId:'p2',therapistId:'t2',date:dateISO(),complaint:'Avaliação inicial pendente — exemplo.',history:'',pain:0,limitations:'',findings:'',goals:'',status:'Rascunho'}
 ],
 plans:[
 {id:'pl1',patientId:'p1',therapistId:'t1',startDate:dateISO(-9),goal:'Reduzir limitações funcionais e recuperar mobilidade.',approach:'Exercícios terapêuticos e acompanhamento funcional.',sessionsPlanned:10,sessionsCompleted:3,weeklyFrequency:2,status:'Ativo'},
 {id:'pl2',patientId:'p3',therapistId:'t3',startDate:dateISO(-15),goal:'Treino de equilíbrio e autonomia.',approach:'Treino orientado por objetivos.',sessionsPlanned:12,sessionsCompleted:5,weeklyFrequency:2,status:'Ativo'}
 ],
 evolutions:[
 {id:'e1',patientId:'p1',therapistId:'t1',date:dateISO(-3),treatment:'Mobilidade e exercícios terapêuticos (exemplo).',response:'Boa tolerância ao atendimento demonstrativo.',instructions:'Exercícios orientados, registro fictício.',painBefore:4,painAfter:2,status:'Finalizada',addenda:[]}
 ],
 charges:[
 {id:'c1',patientId:'p1',description:'Pacote de sessões · exemplo',amountCents:70000,dueDate:dateISO(7),active:true,payments:[{id:'pay1',date:dateISO(-4),amountCents:30000,method:'PIX'}]},
 {id:'c2',patientId:'p2',description:'Avaliação fisioterapêutica',amountCents:18000,dueDate:dateISO(-2),active:true,payments:[]},
 {id:'c3',patientId:'p3',description:'Sessão individual',amountCents:14000,dueDate:dateISO(),active:true,payments:[{id:'pay2',date:dateISO(),amountCents:14000,method:'Dinheiro'}]}
 ],
 expenses:[
 {id:'ex1',description:'Materiais e insumos · exemplo',category:'Operacional',amountCents:8500,date:dateISO(-5),active:true}
 ],
 users:[
 {id:'u1',name:'Administrador · exemplo',email:'admin@example.com',role:'ADMIN',therapistId:'',active:true},
 {id:'u2',name:'Recepção · exemplo',email:'recepcao@example.com',role:'RECEPTION',therapistId:'',active:true},
 {id:'u3',name:'Helena Martins · exemplo',email:'helena@example.com',role:'PROFESSIONAL',therapistId:'t1',active:true}
 ],
 templates:[
 {id:'q1',name:'Anamnese pré-avaliação',version:1,status:'Publicado',active:true,questions:[
 {id:'qq1',label:'Qual sua queixa principal?',kind:'Texto longo',required:true,options:''},
 {id:'qq2',label:'Qual a intensidade da dor de 0 a 10?',kind:'Número',required:true,options:''},
 {id:'qq3',label:'Já realizou fisioterapia anteriormente?',kind:'Sim/Não',required:false,options:''}
 ]},
 {id:'q2',name:'Questionário de acompanhamento funcional',version:1,status:'Rascunho',active:true,questions:[{id:'qq4',label:'Como avalia sua evolução?',kind:'Texto longo',required:true,options:''}]}
 ],
 config:{name:'Instituto Muraro',phone:'',address:'Presidente Epitácio/SP',whatsappText:'Olá, {paciente}! Seu atendimento no Instituto Muraro está agendado para {data} às {hora}.'}
})
