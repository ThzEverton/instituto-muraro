'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import { Activity, Archive, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, CreditCard, DollarSign, Download, Edit3, Eye, FilePlus2, FileText, Filter, HeartPulse, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldAlert, Stethoscope, TrendingUp, UserRound, UserRoundPlus, Users, WalletCards, X, RotateCcw, ChevronDown, MessageCircle, CircleHelp, ListChecks, Trash2 } from 'lucide-react'
import { initialDb, uid, dateISO, fmtDate, money, diffMinutes, plusMinutes, hasConflict, chargePaid, chargeStatus, patientAge, cleanDigits, type DemoDb, type Patient, type Therapist, type ClinicService, type Appointment, type AppointmentStatus, type Assessment, type TherapyPlan, type Evolution, type Charge, type Expense, type User, type Template, type CalendarBlock, type TemplateQuestion } from '@/lib/physio-model'
import { Badge, stateTone, Dialog, Inputs, Table, Empty, SectionHeader, SearchFilter, Metric, Progress, ErrorNote, Hint, PillButton, ExportButton, type FieldDef, type Column } from '@/components/physio/ui'
import './physio.css'

type Page = 'dashboard'|'appointments'|'patients'|'therapists'|'services'|'assessments'|'plans'|'evolutions'|'finance'|'templates'|'users'|'settings'
type FormKind = 'patient'|'therapist'|'service'|'appointment'|'block'|'assessment'|'plan'|'evolution'|'charge'|'payment'|'expense'|'template'|'user'|'addendum'
type ModalState = { kind:FormKind; id?:string; chargeId?:string; evolutionId?:string }
type SearchState = {query:string; filter:string}
const STORAGE_KEY='muraro-physiotherapy-demo-v2'
const pageNames:Record<Page,string>={dashboard:'Visão geral',appointments:'Agenda',patients:'Pacientes',therapists:'Fisioterapeutas',services:'Serviços',assessments:'Avaliações',plans:'Planos terapêuticos',evolutions:'Evoluções',finance:'Financeiro',templates:'Formulários',users:'Usuários',settings:'Configurações'}
const menuItems=[{id:'dashboard' as Page,icon:LayoutDashboard},{id:'appointments' as Page,icon:CalendarDays},{id:'patients' as Page,icon:Users},{id:'therapists' as Page,icon:Stethoscope},{id:'services' as Page,icon:ListChecks},{id:'assessments' as Page,icon:ClipboardCheck},{id:'plans' as Page,icon:Activity},{id:'evolutions' as Page,icon:FileText},{id:'finance' as Page,icon:WalletCards},{id:'templates' as Page,icon:ClipboardList},{id:'users' as Page,icon:UserRound},{id:'settings' as Page,icon:Settings2}]
const filterOptions=[{label:'Todos os status',value:''},{label:'Ativos',value:'Ativo'},{label:'Inativos',value:'Inativo'}]
const appointmentStatuses:AppointmentStatus[]=['Agendado','Confirmado','Em atendimento','Concluído','Não compareceu','Cancelado']
const cashMethods=['PIX','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Outro']
const statusSelect=(options:string[])=>options.map(x=>({label:x,value:x}))
const patientName=(db:DemoDb,id:string)=>db.patients.find(x=>x.id===id)?.name||'Paciente não localizado'
const therapistName=(db:DemoDb,id:string)=>db.therapists.find(x=>x.id===id)?.name||'Profissional não localizado'
const serviceName=(db:DemoDb,id:string)=>db.services.find(x=>x.id===id)?.name||'Serviço não localizado'
const initials=(name:string)=>name.split(' ').slice(0,2).map(p=>p[0]||'').join('').toUpperCase()
const parseReal=(value:any)=>Math.round(Number(String(value||'0').replace(',','.'))*100)
const optionsPatients=(db:DemoDb)=>db.patients.filter(x=>x.active).map(x=>({label:x.name,value:x.id}))
const optionsTherapists=(db:DemoDb)=>db.therapists.filter(x=>x.active).map(x=>({label:x.name,value:x.id}))
const optionsServices=(db:DemoDb)=>db.services.filter(x=>x.active).map(x=>({label:x.name,value:x.id}))
const labelOption=(db:DemoDb,id:string)=>patientName(db,id)
const typePrice=(value:number)=>Number(value||0)/100

function formFields(kind:FormKind,db:DemoDb):FieldDef[]{
 const patients=optionsPatients(db), therapists=optionsTherapists(db), services=optionsServices(db)
 switch(kind){
 case 'patient':return [
 {key:'name',label:'Nome completo',required:true,wide:true,placeholder:'Nome do paciente'}, {key:'birthDate',label:'Data de nascimento',type:'date',required:true},{key:'cpf',label:'CPF (opcional)',placeholder:'000.000.000-00'}, {key:'phone',label:'WhatsApp / telefone',required:true,type:'tel'}, {key:'email',label:'E-mail',type:'email'},{key:'address',label:'Endereço / cidade',wide:true}, {key:'insurance',label:'Forma de atendimento',type:'select',options:statusSelect(['Particular','Convênio - exemplo','Outro'])},{key:'emergencyName',label:'Contato responsável / emergência'},{key:'emergencyPhone',label:'Telefone de emergência',type:'tel'}, {key:'adminNotes',label:'Observações administrativas',type:'textarea',wide:true} ]
 case 'therapist':return [
 {key:'name',label:'Nome do fisioterapeuta',required:true,wide:true},{key:'crefito',label:'Registro CREFITO',required:true,placeholder:'CREFITO da região / número'},{key:'specialty',label:'Área de atuação',required:true,type:'select',options:statusSelect(['Fisioterapia ortopédica','Fisioterapia esportiva','Fisioterapia neurológica','Fisioterapia geriátrica','Fisioterapia pélvica','Fisioterapia respiratória','Fisioterapia pediátrica','Outra'])},{key:'phone',label:'Telefone',type:'tel'},{key:'email',label:'E-mail',type:'email'},{key:'workdays',label:'Horários e dias de atendimento',wide:true,placeholder:'Seg–Sex · 08h–17h'},{key:'color',label:'Cor no calendário',type:'select',options:[{label:'Azul clínico',value:'#2B668F'},{label:'Verde petróleo',value:'#3C897D'},{label:'Areia',value:'#B88652'},{label:'Azul profundo',value:'#334B7B'}]} ]
 case 'service':return [
 {key:'name',label:'Nome do serviço / procedimento',required:true,wide:true},{key:'category',label:'Categoria',required:true,type:'select',options:statusSelect(['Avaliação','Sessão','Reabilitação','Terapia','Pilates','Outro'])},{key:'duration',label:'Duração (minutos)',type:'number',required:true,min:10,max:240},{key:'price',label:'Valor (R$)',type:'number',required:true,min:0},{key:'therapistIds',label:'Fisioterapeutas habilitados',type:'multiselect',options:therapists,wide:true},{key:'description',label:'Descrição do atendimento',type:'textarea',wide:true} ]
 case 'appointment':return [
 {key:'patientId',label:'Paciente',type:'select',options:patients,required:true},{key:'therapistId',label:'Fisioterapeuta',type:'select',options:therapists,required:true},{key:'serviceId',label:'Serviço',type:'select',options:services,required:true},{key:'status',label:'Situação',type:'select',options:statusSelect(appointmentStatuses)},{key:'date',label:'Data',type:'date',required:true},{key:'time',label:'Horário',type:'time',required:true},{key:'note',label:'Observações do agendamento',type:'textarea',wide:true} ]
 case 'block':return [
 {key:'therapistId',label:'Fisioterapeuta',type:'select',options:therapists,required:true},{key:'reason',label:'Motivo do bloqueio',type:'select',required:true,options:statusSelect(['Almoço','Férias','Folga','Reunião','Indisponibilidade','Outro'])},{key:'date',label:'Data inicial',type:'date',required:true},{key:'endDate',label:'Data final (para recorrência)',type:'date'},{key:'start',label:'Hora inicial',type:'time',required:true},{key:'end',label:'Hora final',type:'time',required:true},{key:'recurring',label:'Repetir de segunda a sexta',type:'checkbox',wide:true,help:'Repetir durante o intervalo de datas escolhido'} ]
 case 'assessment':return [
 {key:'patientId',label:'Paciente',required:true,type:'select',options:patients},{key:'therapistId',label:'Fisioterapeuta',required:true,type:'select',options:therapists},{key:'date',label:'Data da avaliação',type:'date',required:true},{key:'status',label:'Estado do documento',type:'select',options:statusSelect(['Rascunho','Finalizada'])},{key:'complaint',label:'Queixa principal / motivo da consulta',type:'textarea',wide:true,required:true},{key:'history',label:'Histórico e início dos sintomas',type:'textarea',wide:true},{key:'pain',label:'Dor EVA (0–10)',type:'number',min:0,max:10},{key:'limitations',label:'Limitações funcionais',type:'textarea',wide:true},{key:'findings',label:'Achados e testes da avaliação',type:'textarea',wide:true},{key:'goals',label:'Objetivos terapêuticos',type:'textarea',wide:true} ]
 case 'plan':return [
 {key:'patientId',label:'Paciente',type:'select',required:true,options:patients},{key:'therapistId',label:'Profissional responsável',type:'select',required:true,options:therapists},{key:'startDate',label:'Data de início',type:'date',required:true},{key:'status',label:'Situação',type:'select',options:statusSelect(['Ativo','Pausado','Concluído'])},{key:'sessionsPlanned',label:'Sessões previstas',type:'number',required:true,min:1},{key:'sessionsCompleted',label:'Sessões concluídas',type:'number',min:0},{key:'weeklyFrequency',label:'Sessões por semana',type:'number',min:1,max:7},{key:'goal',label:'Objetivo terapêutico',type:'textarea',wide:true,required:true},{key:'approach',label:'Conduta / intervenções planejadas',type:'textarea',wide:true} ]
 case 'evolution':return [
 {key:'patientId',label:'Paciente',type:'select',options:patients,required:true},{key:'therapistId',label:'Fisioterapeuta',type:'select',options:therapists,required:true},{key:'date',label:'Data da sessão',type:'date',required:true},{key:'status',label:'Estado do registro',type:'select',options:statusSelect(['Rascunho','Finalizada'])},{key:'painBefore',label:'Dor antes (EVA 0–10)',type:'number',min:0,max:10},{key:'painAfter',label:'Dor depois (EVA 0–10)',type:'number',min:0,max:10},{key:'treatment',label:'Condutas, técnicas e exercícios realizados',type:'textarea',wide:true,required:true},{key:'response',label:'Resposta ao tratamento',type:'textarea',wide:true},{key:'instructions',label:'Orientações e plano para próxima sessão',type:'textarea',wide:true} ]
 case 'charge':return [
 {key:'patientId',label:'Paciente',type:'select',options:patients,required:true},{key:'description',label:'Descrição da cobrança',required:true},{key:'price',label:'Valor (R$)',type:'number',required:true,min:1},{key:'dueDate',label:'Vencimento',type:'date',required:true} ]
 case 'payment':return [{key:'price',label:'Valor recebido (R$)',type:'number',required:true,min:0.01},{key:'date',label:'Data do recebimento',type:'date',required:true},{key:'method',label:'Forma de pagamento',type:'select',options:statusSelect(cashMethods),required:true}]
 case 'expense':return [{key:'description',label:'Descrição da despesa',required:true,wide:true},{key:'category',label:'Categoria',type:'select',required:true,options:statusSelect(['Operacional','Equipamentos','Materiais','Aluguel','Outros'])},{key:'price',label:'Valor (R$)',required:true,type:'number',min:1},{key:'date',label:'Data',type:'date',required:true}]
 case 'template':return [{key:'name',label:'Nome do formulário',required:true,wide:true},{key:'status',label:'Situação',type:'select',options:statusSelect(['Rascunho','Publicado'])}]
 case 'user':return [{key:'name',label:'Nome',required:true,wide:true},{key:'email',label:'E-mail / login',type:'email',required:true},{key:'role',label:'Perfil',required:true,type:'select',options:[{label:'Administrador',value:'ADMIN'},{label:'Recepção',value:'RECEPTION'},{label:'Fisioterapeuta',value:'PROFESSIONAL'}]},{key:'therapistId',label:'Profissional vinculado',type:'select',options:therapists}]
 case 'addendum':return [{key:'text',label:'Complemento auditável (não altera o texto original)',type:'textarea',wide:true,required:true}]
 }
}
const titleForKind:Record<FormKind,string>={patient:'paciente',therapist:'fisioterapeuta',service:'serviço',appointment:'agendamento',block:'bloqueio',assessment:'avaliação',plan:'plano de tratamento',evolution:'evolução',charge:'cobrança',payment:'pagamento',expense:'despesa',template:'formulário',user:'usuário',addendum:'complemento de evolução'}
function downloadCsv(rows:Record<string,string|number>[],name:string){if(typeof window==='undefined')return;const keys=Object.keys(rows[0]||{});const csv=[keys.join(';'),...rows.map(row=>keys.map(k=>'"'+String(row[k]??'').replaceAll('"','""')+'"').join(';'))].join('\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url)}
function Avatar({name,size='normal'}:{name:string;size?:'normal'|'small'}){return <span className={'m-avatar '+(size==='small'?'small':'')}>{initials(name)}</span>}
function IconText({title,caption,initial}:{title:string;caption?:string;initial?:boolean}){return <div className="m-name-cell">{initial&&<Avatar name={title}/>}<span><strong>{title}</strong>{caption&&<small>{caption}</small>}</span></div>}
function TopActions({onNew}: {onNew:()=>void}){return <button className="m-btn primary" onClick={onNew}><Plus size={17}/> Novo atendimento</button>}

export default function Page(){
 const [db,setDb]=useState<DemoDb>(initialDb)
 const [ready,setReady]=useState(false)
 const [page,setPage]=useState<Page>('dashboard')
 const [mobileOpen,setMobileOpen]=useState(false)
 const [modal,setModal]=useState<ModalState|null>(null)
 const [form,setForm]=useState<Record<string,any>>({})
 const [formError,setFormError]=useState('')
 const [notice,setNotice]=useState('')
 const [search,setSearch]=useState<SearchState>({query:'',filter:''})
 const [detailId,setDetailId]=useState<string|null>(null)
 const [detailTab,setDetailTab]=useState<'Resumo'|'Agenda'|'Avaliações'|'Tratamento'|'Evoluções'|'Financeiro'>('Resumo')
 const [therapistFilter,setTherapistFilter]=useState('')
 const [financeTab,setFinanceTab]=useState<'Cobranças'|'Despesas'>('Cobranças')
 const [calendarView,setCalendarView]=useState<'calendar'|'list'>('calendar')
 const [expandedCharge,setExpandedCharge]=useState<string|null>(null)
 const [previewTemplateId,setPreviewTemplateId]=useState<string|null>(null)
 useEffect(()=>{try{const saved=window.localStorage.getItem(STORAGE_KEY);if(saved){const parsed=JSON.parse(saved);const defaults=initialDb();if(parsed&&Array.isArray(parsed.patients)){setDb({...defaults,...parsed})}}}catch{}setReady(true)},[])
 useEffect(()=>{if(ready){try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}catch{}}},[db,ready])
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3700);return()=>clearTimeout(t)},[notice])
 const today=dateISO()
 const navigate=(p:Page)=>{setPage(p);setMobileOpen(false);setSearch({query:'',filter:''});setDetailId(null)}
 const notify=(message:string)=>setNotice(message)
 const updateForm=(key:string,value:any)=>{setForm(v=>({...v,[key]:value}));setFormError('')}
 function openForm(kind:FormKind,item?:any,overrides:Record<string,any>={},links?:{chargeId?:string;evolutionId?:string}){
  if(kind==='evolution'&&item?.status==='Finalizada'){notify('Evoluções finalizadas são imutáveis. Use o complemento.');return}
  if(kind==='assessment'&&item?.status==='Finalizada'){notify('Avaliações finalizadas não podem ser alteradas.');return}
  const defaults:Record<string,any>={date:today,startDate:today,dueDate:today,patientId:db.patients.find(x=>x.active)?.id||'',therapistId:db.therapists.find(x=>x.active)?.id||'',serviceId:db.services.find(x=>x.active)?.id||'',time:'09:00',status:kind==='evolution'||kind==='assessment'?'Rascunho':kind==='plan'?'Ativo':kind==='appointment'?'Agendado':kind==='template'?'Rascunho':'',recurring:false,endDate:dateISO(30),start:'12:00',end:'13:00',price:'',pain:0,painBefore:0,painAfter:0,sessionsPlanned:10,sessionsCompleted:0,weeklyFrequency:2,therapistIds:[],color:'#2B668F',questions:[]}
  const current={...defaults,...(item||{}),...overrides}
  if(item&&'amountCents'in item)current.price=String(typePrice(item.amountCents))
  if(kind==='service'&&item)current.price=String(typePrice(item.priceCents))
  if(kind==='payment'){const charge=db.charges.find(x=>x.id===links?.chargeId);current.price=charge?String((charge.amountCents-chargePaid(charge))/100):'';current.method='PIX'}
  setModal({kind,id:item?.id,chargeId:links?.chargeId,evolutionId:links?.evolutionId});setForm(current);setFormError('')
 }
 function archive(kind:FormKind,id:string){
  if(kind==='evolution'||kind==='assessment'){notify('Documentos clínicos não podem ser apagados; utilize complemento quando aplicável.');return}
  if(!window.confirm('Deseja inativar este registro? O histórico será preservado.'))return
  const key=({patient:'patients',therapist:'therapists',service:'services',charge:'charges',expense:'expenses',template:'templates',user:'users'} as Record<string,keyof DemoDb>)[kind]
  if(key){setDb(old=>({...old,[key]:(old[key] as any[]).map(v=>v.id===id?{...v,active:false}:v)}));notify('Registro inativado.');return}
  if(kind==='appointment'){setDb(old=>({...old,appointments:old.appointments.map(a=>a.id===id?{...a,status:'Cancelado' as AppointmentStatus}:a)}));notify('Agendamento cancelado.')}
  if(kind==='block'){setDb(old=>({...old,blocks:old.blocks.filter(x=>x.id!==id)}));notify('Bloqueio removido da agenda.')}
 }
 function saveForm(){
  if(!modal)return
  const fields=formFields(modal.kind,db)
  for(const field of fields){if(field.required&&(form[field.key]===undefined||form[field.key]===null||String(form[field.key]).trim()==='')){setFormError('Preencha o campo obrigatório: '+field.label+'.');return}}
  const numeric=(field:string)=>Number(form[field]||0)
  if(form.cpf&&cleanDigits(form.cpf).length!==11){setFormError('O CPF precisa ter 11 dígitos.');return}
  if(modal.kind==='patient'&&cleanDigits(form.phone).length<10){setFormError('Informe um telefone com DDD válido.');return}
  if(['assessment','evolution'].includes(modal.kind)&&(['pain','painBefore','painAfter'].some(key=>form[key]!==undefined&&(numeric(key)<0||numeric(key)>10)))){setFormError('A escala de dor precisa ficar entre 0 e 10.');return}
  if(modal.kind==='service'&&(numeric('duration')<10||numeric('duration')>240||parseReal(form.price)<0)){setFormError('Verifique a duração e o valor do serviço.');return}
  if(['charge','expense','payment'].includes(modal.kind)&&parseReal(form.price)<=0){setFormError('O valor deve ser maior que zero.');return}
  if(modal.kind==='block'&&(diffMinutes(form.end)<=diffMinutes(form.start)||Boolean(form.recurring)&&form.endDate<form.date)){setFormError('O horário e o período do bloqueio estão inválidos.');return}
  if(modal.kind==='plan'&&(numeric('sessionsCompleted')>numeric('sessionsPlanned')||numeric('sessionsPlanned')<1)){setFormError('Sessões concluídas não podem exceder as previstas.');return}
  const id=modal.id||uid()
  const oldForm={...form,id}
  if(modal.kind==='appointment'){const selectedService=db.services.find(s=>s.id===form.serviceId);if(!selectedService||!selectedService.active||!selectedService.therapistIds.includes(String(form.therapistId))){setFormError('Esse serviço não está habilitado para o fisioterapeuta escolhido.');return}const proposal:Appointment={id,patientId:String(form.patientId),therapistId:String(form.therapistId),serviceId:String(form.serviceId),date:String(form.date),time:String(form.time),status:form.status||'Agendado',note:String(form.note||'')};const conflict=hasConflict(db,proposal,modal.id);if(conflict){setFormError(conflict);return}setDb(old=>({...old,appointments:modal.id?old.appointments.map(x=>x.id===id?proposal:x):[...old.appointments,proposal]}))}
  else if(modal.kind==='patient'){const item:Patient={id,name:form.name,birthDate:form.birthDate||'',cpf:form.cpf||'',phone:form.phone||'',email:form.email||'',address:form.address||'',emergencyName:form.emergencyName||'',emergencyPhone:form.emergencyPhone||'',insurance:form.insurance||'Particular',adminNotes:form.adminNotes||'',active:modal.id?db.patients.find(x=>x.id===id)?.active??true:true,createdAt:modal.id?db.patients.find(x=>x.id===id)?.createdAt||today:today};setDb(old=>({...old,patients:modal.id?old.patients.map(x=>x.id===id?item:x):[...old.patients,item]}))}
  else if(modal.kind==='therapist'){const item:Therapist={id,name:form.name,crefito:form.crefito,specialty:form.specialty,phone:form.phone||'',email:form.email||'',color:form.color||'#2B668F',workdays:form.workdays||'',active:modal.id?db.therapists.find(x=>x.id===id)?.active??true:true};setDb(old=>({...old,therapists:modal.id?old.therapists.map(x=>x.id===id?item:x):[...old.therapists,item]}))}
  else if(modal.kind==='service'){const item:ClinicService={id,name:form.name,category:form.category,duration:numeric('duration'),priceCents:parseReal(form.price),therapistIds:Array.isArray(form.therapistIds)?form.therapistIds:[],description:form.description||'',active:modal.id?db.services.find(x=>x.id===id)?.active??true:true};setDb(old=>({...old,services:modal.id?old.services.map(x=>x.id===id?item:x):[...old.services,item]}))}
  else if(modal.kind==='block'){const item:CalendarBlock={id,therapistId:form.therapistId,reason:form.reason,date:form.date,endDate:form.endDate||form.date,start:form.start,end:form.end,recurring:Boolean(form.recurring)};setDb(old=>({...old,blocks:modal.id?old.blocks.map(x=>x.id===id?item:x):[...old.blocks,item]}))}
  else if(modal.kind==='assessment'){const item:Assessment={id,patientId:form.patientId,therapistId:form.therapistId,date:form.date,complaint:form.complaint,history:form.history||'',pain:numeric('pain'),limitations:form.limitations||'',findings:form.findings||'',goals:form.goals||'',status:form.status||'Rascunho'};setDb(old=>({...old,assessments:modal.id?old.assessments.map(x=>x.id===id?item:x):[...old.assessments,item]}))}
  else if(modal.kind==='plan'){const item:TherapyPlan={id,patientId:form.patientId,therapistId:form.therapistId,startDate:form.startDate,goal:form.goal,approach:form.approach||'',sessionsPlanned:numeric('sessionsPlanned'),sessionsCompleted:numeric('sessionsCompleted'),weeklyFrequency:numeric('weeklyFrequency'),status:form.status||'Ativo'};setDb(old=>({...old,plans:modal.id?old.plans.map(x=>x.id===id?item:x):[...old.plans,item]}))}
  else if(modal.kind==='evolution'){const item:Evolution={id,patientId:form.patientId,therapistId:form.therapistId,date:form.date,treatment:form.treatment,response:form.response||'',instructions:form.instructions||'',painBefore:numeric('painBefore'),painAfter:numeric('painAfter'),status:form.status||'Rascunho',addenda:modal.id?db.evolutions.find(x=>x.id===id)?.addenda||[]:[]};setDb(old=>({...old,evolutions:modal.id?old.evolutions.map(x=>x.id===id?item:x):[...old.evolutions,item]}))}
  else if(modal.kind==='charge'){const item:Charge={id,patientId:form.patientId,description:form.description,amountCents:parseReal(form.price),dueDate:form.dueDate,payments:modal.id?db.charges.find(x=>x.id===id)?.payments||[]:[],active:true};if(chargePaid(item)>item.amountCents){setFormError('O novo valor não pode ser menor que o que já foi recebido.');return}setDb(old=>({...old,charges:modal.id?old.charges.map(x=>x.id===id?item:x):[...old.charges,item]}))}
  else if(modal.kind==='payment'){const charge=db.charges.find(x=>x.id===modal.chargeId);if(!charge){setFormError('Cobrança não encontrada.');return}const amount=parseReal(form.price);if(amount>charge.amountCents-chargePaid(charge)){setFormError('O pagamento excede o saldo restante de '+money(charge.amountCents-chargePaid(charge))+'.');return}setDb(old=>({...old,charges:old.charges.map(c=>c.id===modal.chargeId?{...c,payments:[...c.payments,{id,date:form.date,amountCents:amount,method:form.method}]}:c)}))}
  else if(modal.kind==='expense'){const item:Expense={id,description:form.description,category:form.category,amountCents:parseReal(form.price),date:form.date,active:true};setDb(old=>({...old,expenses:modal.id?old.expenses.map(x=>x.id===id?item:x):[...old.expenses,item]}))}
  else if(modal.kind==='user'){const item:User={id,name:form.name,email:form.email,role:form.role,therapistId:form.therapistId||'',active:modal.id?db.users.find(x=>x.id===id)?.active??true:true};setDb(old=>({...old,users:modal.id?old.users.map(x=>x.id===id?item:x):[...old.users,item]}))}
  else if(modal.kind==='template'){const item:Template={id,name:form.name,status:form.status||'Rascunho',version:modal.id?(db.templates.find(x=>x.id===id)?.version||1)+1:1,questions:Array.isArray(form.questions)?form.questions:[],active:true};if(item.questions.length===0){setFormError('Adicione pelo menos uma pergunta ao formulário.');return}if(item.questions.some(q=>!q.label.trim()||(q.kind==='Seleção'&&!q.options.trim()))){setFormError('Preencha os enunciados e as opções de perguntas de seleção.');return}setDb(old=>({...old,templates:modal.id?old.templates.map(x=>x.id===id?item:x):[...old.templates,item]}))}
  else if(modal.kind==='addendum'){setDb(old=>({...old,evolutions:old.evolutions.map(e=>e.id===modal.evolutionId?{...e,addenda:[...e.addenda,{id,date:today,text:form.text}]}:e)}))}
  setModal(null);setForm({});notify('Alterações salvas nesta demonstração.')
 }
 function statusAppointment(id:string,status:AppointmentStatus){setDb(old=>({...old,appointments:old.appointments.map(a=>a.id===id?{...a,status}:a)}));notify('Situação do atendimento atualizada.')}
 const filteredQuery=(text:string)=>text.toLocaleLowerCase('pt-BR').includes(search.query.toLocaleLowerCase('pt-BR').trim())
 const onExport=(name:string,rows:Record<string,string|number>[])=>{downloadCsv(rows,name);notify('CSV gerado com os dados sintéticos da demonstração.')}
 const buttonNew=(kind:FormKind,label?:string)=> <button className="m-btn primary" onClick={()=>openForm(kind)}><Plus size={17}/>{label||'Novo '+titleForKind[kind]}</button>
 const buttonEdit=(kind:FormKind,item:any)=> <PillButton title="Editar" onClick={()=>openForm(kind,item)}><Edit3 size={17}/></PillButton>
 const buttonArchive=(kind:FormKind,item:{id:string})=> <PillButton title="Inativar" variant="danger" onClick={()=>archive(kind,item.id)}><Archive size={17}/></PillButton>

 const activePatients=db.patients.filter(p=>p.active)
 const todayAppointments=db.appointments.filter(a=>a.date===today&&a.status!=='Cancelado')
 const receivedMonth=db.charges.flatMap(c=>c.payments.filter(p=>!p.reversedAt&&p.date.slice(0,7)===today.slice(0,7))).reduce((n,p)=>n+p.amountCents,0)
 const overdue=db.charges.filter(c=>chargeStatus(c)==='Vencida').length
 const patientQuery=db.patients.filter(p=>filteredQuery(p.name+' '+p.phone+' '+p.email+' '+p.cpf)&&(search.filter===''||(search.filter==='Ativo'?p.active:!p.active)))
 const therapistQuery=db.therapists.filter(p=>filteredQuery(p.name+' '+p.crefito+' '+p.specialty)&&(search.filter===''||(search.filter==='Ativo'?p.active:!p.active)))
 const serviceQuery=db.services.filter(p=>filteredQuery(p.name+' '+p.category)&&(search.filter===''||(search.filter==='Ativo'?p.active:!p.active)))
 const visibleAppointments=db.appointments.filter(a=>(!therapistFilter||a.therapistId===therapistFilter)&&a.status!=='Cancelado')
 const calendarEvents=useMemo(()=>{
  const events:any[] = visibleAppointments.map(a=>({id:a.id,title:patientName(db,a.patientId).replace(' · exemplo','')+' · '+serviceName(db,a.serviceId),start:a.date+'T'+a.time,end:a.date+'T'+plusMinutes(a.time,db.services.find(s=>s.id===a.serviceId)?.duration||50),color:db.therapists.find(t=>t.id===a.therapistId)?.color||'#2B668F',extendedProps:{kind:'appointment',status:a.status}}))
  for(const block of db.blocks.filter(b=>!therapistFilter||b.therapistId===therapistFilter)){
   if(block.recurring){const first=new Date(block.date+'T12:00:00'),last=new Date(block.endDate+'T12:00:00');for(let dt=new Date(first),n=0;dt<=last&&n<95;dt.setDate(dt.getDate()+1),n++){const day=dt.getDay();if(day===0||day===6)continue;const date=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');events.push({id:block.id+'-'+date,start:date+'T'+block.start,end:date+'T'+block.end,title:block.reason,display:'background',color:'#E4EAF2',extendedProps:{kind:'block'}})}}
   else events.push({id:block.id,start:block.date+'T'+block.start,end:block.date+'T'+block.end,title:block.reason,display:'background',color:'#E4EAF2',extendedProps:{kind:'block'}})
  }
  return events
 },[db,therapistFilter])
 const changeDate=(arg:DateSelectArg)=>{openForm('appointment',undefined,{date:arg.startStr.slice(0,10),time:arg.startStr.slice(11,16)||'09:00'})}
 const changeDrag=(arg:EventDropArg)=>{const a=db.appointments.find(x=>x.id===arg.event.id);if(!a||!arg.event.start){arg.revert();return}const date=arg.event.start.getFullYear()+'-'+String(arg.event.start.getMonth()+1).padStart(2,'0')+'-'+String(arg.event.start.getDate()).padStart(2,'0');const time=String(arg.event.start.getHours()).padStart(2,'0')+':'+String(arg.event.start.getMinutes()).padStart(2,'0');const conflict=hasConflict(db,{...a,date,time},a.id);if(conflict){arg.revert();notify(conflict);return}setDb(old=>({...old,appointments:old.appointments.map(x=>x.id===a.id?{...x,date,time}:x)}));notify('Horário reagendado na demonstração.')}
 const changeEvent=(arg:EventClickArg)=>{const a=db.appointments.find(x=>x.id===arg.event.id);if(a)openForm('appointment',a)}

 const dashboard=<>
  <SectionHeader eyebrow="PAINEL DE CONTROLE" title="Um bom dia para cuidar de pessoas." description={'Resumo da clínica · '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date())} actions={<div className="m-inline-actions"><button className="m-btn secondary" onClick={()=>navigate('appointments')}><CalendarDays size={16}/> Ver agenda</button>{buttonNew('appointment','Novo agendamento')}</div>}/>
  <div className="m-metrics">
   <Metric label="Atendimentos hoje" value={todayAppointments.length} caption="Sessões e avaliações agendadas" icon={<CalendarDays size={19}/>}/>
   <Metric label="Pacientes ativos" value={activePatients.length} caption="Em acompanhamento na clínica" icon={<Users size={19}/>} accent="navy"/>
   <Metric label="Avaliações pendentes" value={db.assessments.filter(x=>x.status==='Rascunho').length} caption="Aguardando conclusão" icon={<ClipboardCheck size={19}/>} accent="amber"/>
   <Metric label="Recebido no mês" value={money(receivedMonth)} caption="Conforme pagamentos registrados" icon={<TrendingUp size={19}/>} accent="teal"/>
  </div>
  <div className="m-dash-grid">
   <section className="m-card m-today-card"><div className="m-card-head"><div><span className="m-eyebrow">PROGRAMAÇÃO</span><h2>Agenda de hoje</h2><p>Atendimentos programados para este dia</p></div><button className="m-text-btn" onClick={()=>navigate('appointments')}>Agenda completa <ArrowRight size={16}/></button></div>
    <div className="m-day-list">{todayAppointments.length===0?<Empty title="Agenda livre para hoje" description="Agende um novo atendimento para visualizar aqui."/>:todayAppointments.sort((a,b)=>a.time.localeCompare(b.time)).map(a=><div className="m-day-item" key={a.id}><time>{a.time}</time><span className="m-day-line"/><div className="m-day-info"><strong>{patientName(db,a.patientId)}</strong><span>{serviceName(db,a.serviceId)}</span><small>{therapistName(db,a.therapistId)}</small></div><Badge tone={stateTone(a.status)}>{a.status}</Badge></div>)}</div>
   </section>
   <div className="m-dash-side"><section className="m-feature-card"><span className="m-feature-icon"><HeartPulse size={25}/></span><span className="m-feature-kicker">ACOMPANHAMENTO FISIOTERAPÊUTICO</span><h2>Organize cada etapa da recuperação.</h2><p>Avaliação funcional, plano de tratamento e evolução das sessões em um só lugar.</p><button onClick={()=>navigate('plans')}>Ver planos terapêuticos <ArrowRight size={17}/></button><div className="m-feature-art"><span/><span/><span/></div></section>
    <section className="m-card m-brief"><div className="m-card-head"><div><h2>Indicadores rápidos</h2><p>O que merece atenção</p></div></div><div className="m-brief-line"><span><ClipboardList size={17}/> Planos em andamento</span><strong>{db.plans.filter(p=>p.status==='Ativo').length}</strong></div><div className="m-brief-line"><span><CreditCard size={17}/> Cobranças vencidas</span><strong className={overdue>0?'warning':''}>{overdue}</strong></div><div className="m-brief-line"><span><CheckCircle2 size={17}/> Sessões concluídas</span><strong>{db.appointments.filter(a=>a.status==='Concluído').length}</strong></div></section>
   </div>
  </div>
  <section className="m-card m-quick-card"><div className="m-card-head"><div><h2>Acesso rápido</h2><p>Principais tarefas do dia a dia</p></div></div><div className="m-quick-grid"><button onClick={()=>openForm('patient')}><span><UserRoundPlus size={20}/></span><strong>Cadastrar paciente</strong><small>Dados e contatos</small></button><button onClick={()=>openForm('assessment')}><span><ClipboardCheck size={20}/></span><strong>Nova avaliação</strong><small>Registro funcional</small></button><button onClick={()=>openForm('plan')}><span><Activity size={20}/></span><strong>Plano terapêutico</strong><small>Metas e sessões</small></button><button onClick={()=>openForm('charge')}><span><WalletCards size={20}/></span><strong>Nova cobrança</strong><small>Controle financeiro</small></button></div></section>
 </>
 const patientsPage=<>
  <SectionHeader eyebrow="CADASTROS" title="Pacientes" description="Dados administrativos, histórico de atendimentos e acompanhamento funcional." actions={<>{buttonNew('patient','Adicionar paciente')}</>}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Cadastro de pacientes</h2><p>{db.patients.length} registros cadastrados · {activePatients.length} ativos</p></div><ExportButton onClick={()=>onExport('pacientes-demo',db.patients.map(p=>({Nome:p.name,Telefone:p.phone,Nascimento:p.birthDate,Atendimento:p.insurance,Status:p.active?'Ativo':'Inativo'})))}/></div>
  <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={filterOptions} placeholder="Buscar paciente, telefone ou CPF..."/>
  <Table<Patient> rows={patientQuery} columns={[
   {label:'Paciente',cell:p=><IconText initial title={p.name} caption={p.email||'Sem e-mail cadastrado'}/>},
   {label:'Contato',cell:p=><div className="m-two-line"><strong>{p.phone}</strong><small>{p.address||'Cidade não informada'}</small></div>},
   {label:'Idade',cell:p=>patientAge(p.birthDate)},
   {label:'Atendimento',cell:p=>p.insurance},
   {label:'Situação',cell:p=><Badge tone={p.active?'green':'red'}>{p.active?'Ativo':'Inativo'}</Badge>}
  ]} onRowClick={p=>{setDetailId(p.id);setDetailTab('Resumo')}} actions={p=><><PillButton title="Ver perfil" onClick={()=>{setDetailId(p.id);setDetailTab('Resumo')}}><Eye size={16}/></PillButton>{buttonEdit('patient',p)}{p.active&&buttonArchive('patient',p)}</>}/>
  </section>
 </>
 const therapistsPage=<>
  <SectionHeader eyebrow="EQUIPE" title="Fisioterapeutas" description="Organize a equipe, especialidades, registros profissionais e disponibilidade." actions={buttonNew('therapist','Adicionar fisioterapeuta')}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Equipe clínica</h2><p>Profissionais e áreas de atuação</p></div></div>
   <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={filterOptions} placeholder="Buscar profissional, especialidade ou CREFITO..."/>
   <Table<Therapist> rows={therapistQuery} columns={[
    {label:'Fisioterapeuta',cell:t=><IconText initial title={t.name} caption={t.email}/>},
    {label:'CREFITO',cell:t=><span className="m-semibold">{t.crefito}</span>},
    {label:'Área de atuação',cell:t=><span>{t.specialty}</span>},
    {label:'Disponibilidade',cell:t=><div className="m-two-line"><strong>{t.workdays||'Não cadastrada'}</strong><small>{db.appointments.filter(a=>a.therapistId===t.id&&a.date===today&&a.status!=='Cancelado').length} atendimentos hoje</small></div>},
    {label:'Status',cell:t=><Badge tone={t.active?'green':'red'}>{t.active?'Ativo':'Inativo'}</Badge>}
   ]} actions={t=><>{buttonEdit('therapist',t)}{t.active&&buttonArchive('therapist',t)}</>}/>
  </section>
 </>
 const servicesPage=<>
  <SectionHeader eyebrow="CATÁLOGO" title="Serviços e procedimentos" description="Defina procedimentos, preços, duração e profissionais habilitados." actions={buttonNew('service','Adicionar serviço')}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Serviços oferecidos</h2><p>Os valores são de demonstração e podem ser alterados</p></div><ExportButton onClick={()=>onExport('servicos-demo',db.services.map(s=>({Serviço:s.name,Categoria:s.category,Duração:s.duration,Preço:money(s.priceCents)})))}/></div>
  <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={filterOptions}/>
  <Table<ClinicService> rows={serviceQuery} columns={[
   {label:'Procedimento',cell:s=><div className="m-two-line"><strong>{s.name}</strong><small>{s.description||'Sem descrição'}</small></div>},
   {label:'Categoria',cell:s=><Badge tone="blue">{s.category}</Badge>},
   {label:'Duração',cell:s=>s.duration+' min'},
   {label:'Valor',cell:s=><strong>{money(s.priceCents)}</strong>},
   {label:'Habilitados',cell:s=><span>{s.therapistIds.length} profissional(is)</span>},
   {label:'Status',cell:s=><Badge tone={s.active?'green':'red'}>{s.active?'Ativo':'Inativo'}</Badge>}
  ]} actions={s=><>{buttonEdit('service',s)}{s.active&&buttonArchive('service',s)}</>}/>
  </section>
 </>
 const appointmentsPage=<>
  <SectionHeader eyebrow="GESTÃO DE HORÁRIOS" title="Agenda de atendimentos" description="Visualize sessões, bloqueios, horários e disponibilidade da equipe." actions={<>{buttonNew('block','Bloquear horário')}{buttonNew('appointment','Novo agendamento')}</>}/>
  <section className="m-card m-agenda-card"><div className="m-agenda-toolbar"><div className="m-agenda-filters"><label>Fisioterapeuta <select value={therapistFilter} onChange={e=>setTherapistFilter(e.target.value)}><option value="">Todos os profissionais</option>{optionsTherapists(db).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div><div className="m-view-switch"><button className={calendarView==='calendar'?'active':''} onClick={()=>setCalendarView('calendar')}><CalendarDays size={16}/> Calendário</button><button className={calendarView==='list'?'active':''} onClick={()=>setCalendarView('list')}><ClipboardList size={16}/> Lista</button></div></div>
   <div className="m-agenda-legend">{db.therapists.filter(t=>t.active&&(!therapistFilter||t.id===therapistFilter)).map(t=><span key={t.id}><i style={{background:t.color}}/>{t.name.replace(' · exemplo','')}</span>)}<span><i style={{background:'#D6DFEB'}}/>Bloqueios</span></div>
   {calendarView==='calendar'?<div className="m-cal-wrap"><FullCalendar plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]} locale="pt-br" initialView="timeGridWeek" initialDate={today} headerToolbar={{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,timeGridDay'}} buttonText={{today:'Hoje',month:'Mês',week:'Semana',day:'Dia'}} allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:30:00" nowIndicator editable selectable selectMirror events={calendarEvents} select={changeDate} eventClick={changeEvent} eventDrop={changeDrag} height="auto" dayMaxEvents={3}/></div>:
    <Table<Appointment> rows={visibleAppointments.filter(a=>filteredQuery(patientName(db,a.patientId)+' '+therapistName(db,a.therapistId)))} columns={[
     {label:'Data / hora',cell:a=><div className="m-two-line"><strong>{fmtDate(a.date)}</strong><small>{a.time}</small></div>},
     {label:'Paciente',cell:a=><strong>{patientName(db,a.patientId)}</strong>},
     {label:'Fisioterapeuta',cell:a=>therapistName(db,a.therapistId)},
     {label:'Serviço',cell:a=>serviceName(db,a.serviceId)},
     {label:'Situação',cell:a=><Badge tone={stateTone(a.status)}>{a.status}</Badge>}
    ]} actions={a=><>{buttonEdit('appointment',a)}<PillButton title="Confirmar atendimento" onClick={()=>statusAppointment(a.id,'Confirmado')}><Check size={16}/></PillButton></>}/>}
  </section>
  <section className="m-card m-blocks-card"><div className="m-card-head"><div><h2>Bloqueios e indisponibilidades</h2><p>Intervalos, folgas e períodos recorrentes da equipe</p></div><button className="m-text-btn" onClick={()=>openForm('block')}><Plus size={16}/> Novo bloqueio</button></div>
   {db.blocks.length===0?<Empty title="Sem bloqueios cadastrados" description="Adicione almoços, férias ou folgas para proteger a agenda."/>:<div className="m-block-list">{db.blocks.map(b=><div key={b.id}><span className="m-block-symbol"><LockKeyhole size={17}/></span><div><strong>{b.reason}</strong><small>{therapistName(db,b.therapistId)} · {b.start}–{b.end} · {b.recurring?'Dias úteis, de '+fmtDate(b.date)+' até '+fmtDate(b.endDate):fmtDate(b.date)}</small></div><PillButton title="Editar" onClick={()=>openForm('block',b)}><Edit3 size={16}/></PillButton><PillButton title="Remover bloqueio" variant="danger" onClick={()=>archive('block',b.id)}><X size={16}/></PillButton></div>)}</div>}
  </section>
 </>

 const assessmentsPage=<>
  <SectionHeader eyebrow="ATENDIMENTO CLÍNICO" title="Avaliações fisioterapêuticas" description="Queixa principal, avaliação funcional, dor EVA e definição dos objetivos." actions={buttonNew('assessment','Nova avaliação')}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Histórico de avaliações</h2><p>Documentos clínicos demonstrativos com rascunhos e finalização</p></div></div>
   <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={[{label:'Todas as avaliações',value:''},...statusSelect(['Rascunho','Finalizada'])]}/>
   <Table<Assessment> rows={db.assessments.filter(a=>filteredQuery(patientName(db,a.patientId)+' '+therapistName(db,a.therapistId)+' '+a.complaint)&&(!search.filter||search.filter===a.status))} columns={[
    {label:'Paciente',cell:a=><IconText initial title={patientName(db,a.patientId)} caption={therapistName(db,a.therapistId)}/>},
    {label:'Data',cell:a=>fmtDate(a.date)},
    {label:'Queixa principal',cell:a=><span className="m-ellipsis" title={a.complaint}>{a.complaint}</span>},
    {label:'Dor (EVA)',cell:a=><span className="m-pain-score">{a.pain}/10</span>},
    {label:'Situação',cell:a=><Badge tone={stateTone(a.status)}>{a.status}</Badge>}
   ]} actions={a=><>{a.status==='Rascunho'?buttonEdit('assessment',a):<PillButton title="Ver no perfil do paciente" onClick={()=>{setDetailId(a.patientId);setDetailTab('Avaliações')}}><Eye size={16}/></PillButton>}</>}/>
  </section>
 </>
 const plansPage=<>
  <SectionHeader eyebrow="REABILITAÇÃO" title="Planos terapêuticos" description="Acompanhe metas, frequência de atendimento e evolução do plano de cada paciente." actions={buttonNew('plan','Novo plano de tratamento')}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Planos de tratamento</h2><p>Organização de objetivos e sessões previstas</p></div></div>
   <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={[{label:'Todos os planos',value:''},...statusSelect(['Ativo','Pausado','Concluído'])]}/>
   <Table<TherapyPlan> rows={db.plans.filter(p=>filteredQuery(patientName(db,p.patientId)+' '+p.goal)&&(!search.filter||p.status===search.filter))} columns={[
    {label:'Paciente',cell:p=><IconText initial title={patientName(db,p.patientId)} caption={therapistName(db,p.therapistId)}/>},
    {label:'Objetivo terapêutico',cell:p=><span className="m-ellipsis" title={p.goal}>{p.goal}</span>},
    {label:'Frequência',cell:p=>p.weeklyFrequency+'x / semana'},
    {label:'Sessões',cell:p=><div className="m-prog-cell"><span>{p.sessionsCompleted} de {p.sessionsPlanned}</span><Progress done={p.sessionsCompleted} total={p.sessionsPlanned}/></div>},
    {label:'Situação',cell:p=><Badge tone={stateTone(p.status)}>{p.status}</Badge>}
   ]} actions={p=><>{buttonEdit('plan',p)}{p.status==='Ativo'&&p.sessionsCompleted<p.sessionsPlanned&&<PillButton title="Concluir mais uma sessão demonstrativa" variant="success" onClick={()=>{setDb(old=>({...old,plans:old.plans.map(x=>x.id===p.id?{...x,sessionsCompleted:x.sessionsCompleted+1,status:x.sessionsCompleted+1>=x.sessionsPlanned?'Concluído':'Ativo'}:x)}));notify('Sessão contabilizada no plano demonstrativo.')}}><Check size={16}/></PillButton>}</>}/>
  </section>
  <div className="m-info-row"><CircleHelp size={17}/> Cada plano é individual e deve ser validado pelo fisioterapeuta responsável em um sistema clínico seguro.</div>
 </>
 const evolutionsPage=<>
  <SectionHeader eyebrow="PRONTUÁRIO" title="Evoluções de sessões" description="Registros de procedimentos, resposta funcional, dor e orientações por atendimento." actions={buttonNew('evolution','Registrar evolução')}/>
  <section className="m-card"><div className="m-clinical-notice"><ShieldAlert size={20}/><div><strong>Integridade do registro clínico</strong><p>Evoluções finalizadas não podem ser alteradas nem apagadas nesta demonstração. Complementos são adicionados ao histórico.</p></div></div>
   <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={[{label:'Todas as evoluções',value:''},...statusSelect(['Rascunho','Finalizada'])]}/>
   <Table<Evolution> rows={db.evolutions.filter(e=>filteredQuery(patientName(db,e.patientId)+' '+e.treatment)&&(!search.filter||e.status===search.filter))} columns={[
    {label:'Paciente',cell:e=><IconText initial title={patientName(db,e.patientId)} caption={therapistName(db,e.therapistId)}/>},
    {label:'Data da sessão',cell:e=>fmtDate(e.date)},
    {label:'Procedimentos',cell:e=><span className="m-ellipsis" title={e.treatment}>{e.treatment}</span>},
    {label:'Dor antes / depois',cell:e=><span className="m-semibold">{e.painBefore} / {e.painAfter}</span>},
    {label:'Status',cell:e=><Badge tone={stateTone(e.status)}>{e.status}</Badge>}
   ]} actions={e=><>{e.status==='Rascunho'?buttonEdit('evolution',e):<PillButton title="Ver perfil" onClick={()=>{setDetailId(e.patientId);setDetailTab('Evoluções')}}><Eye size={16}/></PillButton>}{e.status==='Finalizada'&&<PillButton title="Adicionar complemento" onClick={()=>openForm('addendum',undefined,{}, {evolutionId:e.id})}><FilePlus2 size={16}/></PillButton>}</>}/>
  </section>
 </>
 const paidSum=db.charges.reduce((sum,c)=>sum+chargePaid(c),0)
 const pendingSum=db.charges.filter(c=>c.active).reduce((sum,c)=>sum+Math.max(0,c.amountCents-chargePaid(c)),0)
 const expensesSum=db.expenses.filter(e=>e.active).reduce((sum,e)=>sum+e.amountCents,0)
 const financePage=<>
  <SectionHeader eyebrow="GESTÃO FINANCEIRA" title="Financeiro" description="Cobranças, recebimentos, saldos e despesas em uma visão organizada." actions={<>{buttonNew('expense','Nova despesa')}{buttonNew('charge','Nova cobrança')}</>}/>
  <div className="m-metrics compact">
   <Metric label="Recebimentos" value={money(paidSum)} caption="Pagamentos efetivados" icon={<WalletCards size={19}/>} accent="teal"/>
   <Metric label="A receber" value={money(pendingSum)} caption="Saldo de cobranças abertas" icon={<CreditCard size={19}/>} accent="blue"/>
   <Metric label="Despesas" value={money(expensesSum)} caption="Despesas registradas" icon={<DollarSign size={19}/>} accent="amber"/>
   <Metric label="Resultado demonstrativo" value={money(paidSum-expensesSum)} caption="Recebimentos menos despesas" icon={<TrendingUp size={19}/>} accent="navy"/>
  </div>
  <section className="m-card"><div className="m-module-intro"><div><h2>Lançamentos financeiros</h2><p>Valores de demonstração, sem integração bancária</p></div><div className="m-segmented"><button className={financeTab==='Cobranças'?'active':''} onClick={()=>setFinanceTab('Cobranças')}>Cobranças</button><button className={financeTab==='Despesas'?'active':''} onClick={()=>setFinanceTab('Despesas')}>Despesas</button></div></div>
   {financeTab==='Cobranças'?<>
    <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={[{label:'Todas as cobranças',value:''},...statusSelect(['Pendente','Parcial','Paga','Vencida','Cancelada'])]}/>
    <Table<Charge> rows={db.charges.filter(c=>filteredQuery(patientName(db,c.patientId)+' '+c.description)&&(!search.filter||chargeStatus(c)===search.filter))} columns={[
     {label:'Paciente / descrição',cell:c=><div className="m-two-line"><strong>{patientName(db,c.patientId)}</strong><small>{c.description}</small></div>},
     {label:'Vencimento',cell:c=>fmtDate(c.dueDate)},
     {label:'Total',cell:c=><strong>{money(c.amountCents)}</strong>},
     {label:'Recebido',cell:c=>money(chargePaid(c))},
     {label:'Saldo',cell:c=><strong>{money(Math.max(0,c.amountCents-chargePaid(c)))}</strong>},
     {label:'Status',cell:c=><Badge tone={stateTone(chargeStatus(c))}>{chargeStatus(c)}</Badge>}
    ]} actions={c=><>{c.active&&chargePaid(c)<c.amountCents&&<PillButton title="Registrar pagamento" variant="success" onClick={()=>openForm('payment',undefined,{}, {chargeId:c.id})}><DollarSign size={17}/></PillButton>}<PillButton title="Ver pagamentos e estornar" onClick={()=>setExpandedCharge(expandedCharge===c.id?null:c.id)}><Eye size={16}/></PillButton>{c.active&&buttonEdit('charge',c)}{c.active&&chargePaid(c)===0&&buttonArchive('charge',c)}</>}/>
    {expandedCharge&&db.charges.find(c=>c.id===expandedCharge)&&<div className="m-payments-detail"><h3>Histórico de pagamentos · {db.charges.find(c=>c.id===expandedCharge)?.description}</h3>{(db.charges.find(c=>c.id===expandedCharge)?.payments||[]).length===0?<p>Não há pagamentos para esta cobrança.</p>:db.charges.find(c=>c.id===expandedCharge)!.payments.map(p=><div className="m-payment-line" key={p.id}><span><strong>{money(p.amountCents)}</strong><small>{fmtDate(p.date)} · {p.method}</small></span><Badge tone={p.reversedAt?'red':'green'}>{p.reversedAt?'Estornado':'Recebido'}</Badge>{!p.reversedAt&&<button className="m-text-btn danger" onClick={()=>{if(!window.confirm('Registrar estorno deste pagamento na demonstração?'))return;setDb(old=>({...old,charges:old.charges.map(c=>c.id===expandedCharge?{...c,payments:c.payments.map(x=>x.id===p.id?{...x,reversedAt:today}:x)}:c)}));notify('Estorno registrado no histórico.')}}><RotateCcw size={15}/> Estornar</button>}</div>)}</div>}
   </>:<>
    <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} placeholder="Buscar despesa ou categoria..."/>
    <Table<Expense> rows={db.expenses.filter(x=>filteredQuery(x.description+' '+x.category))} columns={[
     {label:'Descrição',cell:e=><strong>{e.description}</strong>},
     {label:'Categoria',cell:e=><Badge tone="blue">{e.category}</Badge>},
     {label:'Data',cell:e=>fmtDate(e.date)},
     {label:'Valor',cell:e=><strong>{money(e.amountCents)}</strong>},
     {label:'Situação',cell:e=><Badge tone={e.active?'green':'red'}>{e.active?'Ativa':'Inativa'}</Badge>}
    ]} actions={e=><>{buttonEdit('expense',e)}{e.active&&buttonArchive('expense',e)}</>}/>
   </>}
  </section>
 </>
 const templatesPage=<>
  <SectionHeader eyebrow="ANAMNESE PRÉ-ATENDIMENTO" title="Formulários" description="Prepare perguntas de saúde e avaliação funcional para o atendimento." actions={buttonNew('template','Criar formulário')}/>
  <section className="m-card"><div className="m-module-intro"><div><h2>Modelos de questionário</h2><p>Configure perguntas, campos obrigatórios e versões de demonstração</p></div></div>
   <Table<Template> rows={db.templates.filter(t=>t.active)} columns={[
    {label:'Formulário',cell:t=><div className="m-two-line"><strong>{t.name}</strong><small>{t.questions.length} perguntas cadastradas</small></div>},
    {label:'Versão',cell:t=>'v'+t.version},
    {label:'Situação',cell:t=><Badge tone={stateTone(t.status)}>{t.status}</Badge>},
    {label:'Disponibilidade',cell:t=><span>{t.status==='Publicado'?'Prévia disponível':'Em elaboração'}</span>}
   ]} actions={t=><><PillButton title="Editar perguntas" onClick={()=>openForm('template',t)}><Edit3 size={16}/></PillButton><PillButton title="Visualizar formulário" onClick={()=>setPreviewTemplateId(t.id)}><Eye size={16}/></PillButton>{buttonArchive('template',t)}</>}/>
  </section>
  <div className="m-info-row"><LockKeyhole size={17}/> Pré-visualizações são locais. Links externos individuais e envio real exigem autenticação e backend clínico seguro.</div>
 </>
 const usersPage=<>
  <SectionHeader eyebrow="ACESSOS" title="Usuários" description="Cadastros de operadores e perfis previstos para o sistema clínico." actions={buttonNew('user','Adicionar usuário')}/>
  <section className="m-card"><div className="m-clinical-notice"><ShieldAlert size={18}/><div><strong>Perfis de demonstração</strong><p>Os perfis visuais não concedem acesso real. Permissões clínicas deverão ser aplicadas e auditadas no backend.</p></div></div>
  <SearchFilter search={search.query} setSearch={v=>setSearch(s=>({...s,query:v}))} filter={search.filter} setFilter={v=>setSearch(s=>({...s,filter:v}))} options={filterOptions}/>
  <Table<User> rows={db.users.filter(u=>filteredQuery(u.name+' '+u.email)&&(search.filter===''||(search.filter==='Ativo'?u.active:!u.active)))} columns={[
   {label:'Usuário',cell:u=><IconText initial title={u.name} caption={u.email}/>},
   {label:'Perfil',cell:u=><Badge tone="blue">{u.role==='ADMIN'?'Administrador':u.role==='RECEPTION'?'Recepção':'Fisioterapeuta'}</Badge>},
   {label:'Profissional vinculado',cell:u=>u.therapistId?therapistName(db,u.therapistId):'—'},
   {label:'Status',cell:u=><Badge tone={u.active?'green':'red'}>{u.active?'Ativo':'Inativo'}</Badge>}
  ]} actions={u=><>{buttonEdit('user',u)}{u.active&&buttonArchive('user',u)}</>}/>
  </section>
 </>
 const settingsPage=<>
  <SectionHeader eyebrow="PREFERÊNCIAS" title="Configurações da clínica" description="Personalize informações de contato e os textos utilizados na demonstração." />
  <div className="m-settings-grid"><section className="m-card"><div className="m-card-head"><div><h2>Informações da clínica</h2><p>Dados administrativos</p></div></div><Inputs fields={[
   {key:'name',label:'Nome da clínica',required:true,wide:true},{key:'phone',label:'Telefone',type:'tel'},{key:'address',label:'Localização',wide:true}
  ]} form={db.config} onChange={(key,value)=>setDb(old=>({...old,config:{...old.config,[key]:value}}))}/><div className="m-settings-save"><Badge tone="green">Salvo neste navegador</Badge></div></section>
  <section className="m-card"><div className="m-card-head"><div><h2>Texto de confirmação</h2><p>Mensagem para copiar no WhatsApp, sem envio automático</p></div></div><Inputs fields={[{key:'whatsappText',label:'Modelo da mensagem',type:'textarea',wide:true,help:'Variáveis: {paciente}, {data} e {hora}'}]} form={db.config} onChange={(key,value)=>setDb(old=>({...old,config:{...old.config,[key]:value}}))}/><button className="m-btn secondary" onClick={()=>{const a=db.appointments[0];if(!a)return;const text=db.config.whatsappText.replace('{paciente}',patientName(db,a.patientId)).replace('{data}',fmtDate(a.date)).replace('{hora}',a.time);void navigator.clipboard?.writeText(text);notify('Texto de exemplo copiado.')}}><MessageCircle size={17}/> Copiar exemplo</button></section></div>
  <section className="m-card m-danger-zone"><div><h2>Dados da demonstração</h2><p>Remova as alterações locais e retorne aos cadastros fictícios iniciais.</p></div><button className="m-btn danger-outline" onClick={()=>{if(!window.confirm('Restaurar todos os dados fictícios desta demonstração?'))return;setDb(initialDb());notify('Dados demonstrativos restaurados.')}}><RotateCcw size={17}/> Restaurar dados de exemplo</button></section>
 </>

 const detailPatient=db.patients.find(p=>p.id===detailId)
 const patientDetail=detailPatient&&<div className="m-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetailId(null)}}>
  <aside className="m-profile-panel" role="dialog" aria-modal="true" aria-label="Perfil do paciente">
   <header className="m-profile-top"><div className="m-profile-ident"><Avatar name={detailPatient.name}/><div><span className="m-eyebrow">PRONTUÁRIO DEMONSTRATIVO</span><h2>{detailPatient.name}</h2><small>{patientAge(detailPatient.birthDate)} · {detailPatient.insurance}</small></div></div><button className="m-icon-btn" onClick={()=>setDetailId(null)} aria-label="Fechar perfil"><X size={20}/></button></header>
   <div className="m-profile-tags"><Badge tone={detailPatient.active?'green':'red'}>{detailPatient.active?'Paciente ativo':'Paciente inativo'}</Badge><span>Cadastro em {fmtDate(detailPatient.createdAt)}</span></div>
   <nav className="m-profile-tabs" aria-label="Seções do paciente">{(['Resumo','Agenda','Avaliações','Tratamento','Evoluções','Financeiro'] as const).map(t=><button key={t} className={detailTab===t?'active':''} onClick={()=>setDetailTab(t)}>{t}</button>)}</nav>
   <div className="m-profile-content">
    {detailTab==='Resumo'&&<><h3>Dados do paciente</h3><div className="m-profile-grid">
     <div><span>Telefone</span><strong>{detailPatient.phone}</strong></div><div><span>E-mail</span><strong>{detailPatient.email||'—'}</strong></div>
     <div><span>Nascimento</span><strong>{fmtDate(detailPatient.birthDate)}</strong></div><div><span>CPF</span><strong>{detailPatient.cpf||'Não informado'}</strong></div>
     <div><span>Cidade / endereço</span><strong>{detailPatient.address||'—'}</strong></div><div><span>Responsável / emergência</span><strong>{detailPatient.emergencyName||'—'}<br/>{detailPatient.emergencyPhone||''}</strong></div>
     <div className="full"><span>Observações administrativas</span><strong>{detailPatient.adminNotes||'Nenhuma observação cadastrada.'}</strong></div>
    </div><div className="m-profile-actions"><button className="m-btn secondary" onClick={()=>openForm('patient',detailPatient)}><Edit3 size={16}/> Editar cadastro</button><button className="m-btn primary" onClick={()=>{setDetailId(null);openForm('appointment',undefined,{patientId:detailPatient.id})}}><Plus size={16}/> Agendar sessão</button></div></>}
    {detailTab==='Agenda'&&<><div className="m-profile-subhead"><h3>Atendimentos</h3><button onClick={()=>{setDetailId(null);openForm('appointment',undefined,{patientId:detailPatient.id})}}><Plus size={15}/> Novo</button></div>{db.appointments.filter(a=>a.patientId===detailPatient.id).length===0?<Empty title="Nenhum agendamento" description="Agende um atendimento para iniciar o acompanhamento."/>:db.appointments.filter(a=>a.patientId===detailPatient.id).map(a=><div className="m-profile-row" key={a.id}><span className="m-profile-row-icon"><CalendarDays size={18}/></span><div><strong>{fmtDate(a.date)} · {a.time}</strong><small>{serviceName(db,a.serviceId)} · {therapistName(db,a.therapistId)}</small></div><Badge tone={stateTone(a.status)}>{a.status}</Badge></div>)}</>}
    {detailTab==='Avaliações'&&<><div className="m-profile-subhead"><h3>Avaliações funcionais</h3><button onClick={()=>{setDetailId(null);openForm('assessment',undefined,{patientId:detailPatient.id})}}><Plus size={15}/> Nova</button></div>{db.assessments.filter(a=>a.patientId===detailPatient.id).length===0?<Empty title="Nenhuma avaliação" description="Cadastre uma avaliação inicial com histórico, dor EVA e limitações."/>:db.assessments.filter(a=>a.patientId===detailPatient.id).map(a=><article className="m-record-card" key={a.id}><header><strong>{fmtDate(a.date)} · {therapistName(db,a.therapistId)}</strong><Badge tone={stateTone(a.status)}>{a.status}</Badge></header><p><b>Queixa:</b> {a.complaint}</p><p><b>Histórico:</b> {a.history||'—'}</p><p><b>Dor EVA:</b> {a.pain}/10</p><p><b>Limitações:</b> {a.limitations||'—'}</p><p><b>Achados:</b> {a.findings||'—'}</p><p><b>Objetivos:</b> {a.goals||'—'}</p></article>)}</>}
    {detailTab==='Tratamento'&&<><div className="m-profile-subhead"><h3>Planos terapêuticos</h3><button onClick={()=>{setDetailId(null);openForm('plan',undefined,{patientId:detailPatient.id})}}><Plus size={15}/> Novo</button></div>{db.plans.filter(p=>p.patientId===detailPatient.id).length===0?<Empty title="Nenhum plano definido" description="Crie objetivos terapêuticos e programe sessões."/>:db.plans.filter(p=>p.patientId===detailPatient.id).map(p=><article key={p.id} className="m-record-card"><header><strong>Iniciado em {fmtDate(p.startDate)}</strong><Badge tone={stateTone(p.status)}>{p.status}</Badge></header><p><b>Objetivo:</b> {p.goal}</p><p><b>Conduta:</b> {p.approach}</p><div className="m-profile-progress"><span>{p.sessionsCompleted} / {p.sessionsPlanned} sessões · {p.weeklyFrequency}x/semana</span><Progress done={p.sessionsCompleted} total={p.sessionsPlanned}/></div></article>)}</>}
    {detailTab==='Evoluções'&&<><div className="m-profile-subhead"><h3>Evoluções clínicas</h3><button onClick={()=>{setDetailId(null);openForm('evolution',undefined,{patientId:detailPatient.id})}}><Plus size={15}/> Registrar</button></div>{db.evolutions.filter(e=>e.patientId===detailPatient.id).length===0?<Empty title="Sem evoluções" description="Registre as sessões e respostas ao tratamento."/>:db.evolutions.filter(e=>e.patientId===detailPatient.id).map(e=><article className="m-record-card" key={e.id}><header><strong>{fmtDate(e.date)} · {therapistName(db,e.therapistId)}</strong><Badge tone={stateTone(e.status)}>{e.status}</Badge></header><p><b>Procedimentos:</b> {e.treatment}</p><p><b>Resposta:</b> {e.response||'—'}</p><p><b>Orientações:</b> {e.instructions||'—'}</p><p><b>Dor:</b> {e.painBefore} → {e.painAfter}</p>{e.addenda.map(a=><div className="m-addendum" key={a.id}><strong>Complemento · {fmtDate(a.date)}</strong><p>{a.text}</p></div>)}{e.status==='Finalizada'&&<button className="m-text-btn" onClick={()=>openForm('addendum',undefined,{}, {evolutionId:e.id})}><FilePlus2 size={15}/> Adicionar complemento</button>}</article>)}</>}
    {detailTab==='Financeiro'&&<><div className="m-profile-subhead"><h3>Cobranças e recebimentos</h3><button onClick={()=>{setDetailId(null);openForm('charge',undefined,{patientId:detailPatient.id})}}><Plus size={15}/> Cobrança</button></div>{db.charges.filter(c=>c.patientId===detailPatient.id).length===0?<Empty title="Nenhuma cobrança" description="Adicione uma cobrança vinculada ao paciente."/>:db.charges.filter(c=>c.patientId===detailPatient.id).map(c=><article className="m-record-card" key={c.id}><header><strong>{c.description}</strong><Badge tone={stateTone(chargeStatus(c))}>{chargeStatus(c)}</Badge></header><p><b>Valor:</b> {money(c.amountCents)} · <b>Recebido:</b> {money(chargePaid(c))}</p><p><b>Saldo:</b> {money(Math.max(0,c.amountCents-chargePaid(c)))} · <b>Vencimento:</b> {fmtDate(c.dueDate)}</p></article>)}</>}
   </div>
   <footer className="m-profile-footer"><LockKeyhole size={14}/> Dados sintéticos. Prontuário real exige autenticação e controle de acesso.</footer>
  </aside>
 </div>
 const activeTemplate=db.templates.find(t=>t.id===previewTemplateId)
 const templatePreview=activeTemplate&&<Dialog title={activeTemplate.name} subtitle="Prévia demonstrativa — nenhuma resposta clínica é transmitida" onClose={()=>setPreviewTemplateId(null)} footer={<button className="m-btn secondary" onClick={()=>setPreviewTemplateId(null)}>Fechar visualização</button>}>
  <div className="m-demo-preview"><div className="m-demo-preview-header"><ClipboardList size={22}/><strong>Pré-avaliação fisioterapêutica</strong><Badge tone={stateTone(activeTemplate.status)}>{activeTemplate.status}</Badge></div>
  {activeTemplate.questions.map((q,i)=><label className="m-preview-question" key={q.id}><span>{i+1}. {q.label}{q.required&&' *'}</span>{q.kind==='Texto longo'?<textarea placeholder="Campo de pré-visualização" disabled/>:q.kind==='Seleção'?<select disabled><option>Selecione...</option>{q.options.split(',').map(opt=><option key={opt}>{opt.trim()}</option>)}</select>:q.kind==='Sim/Não'?<select disabled><option>Selecione...</option><option>Sim</option><option>Não</option></select>:<input type={q.kind==='Número'?'number':q.kind==='Data'?'date':'text'} disabled placeholder="Campo de pré-visualização"/>}</label>)}
  <div className="m-info-row"><LockKeyhole size={16}/> Para receber respostas reais, configure tokens individuais seguros no backend.</div></div>
 </Dialog>

 const kindFields=modal?formFields(modal.kind,db):[]
 const isClinical=modal&&['assessment','evolution','addendum'].includes(modal.kind)
 const formModal=modal&&<Dialog title={(modal.id?'Editar ':'Novo ')+titleForKind[modal.kind]} subtitle={modal.kind==='payment'?'Registre recebimentos parciais sem ultrapassar o saldo.':isClinical?'Registro clínico demonstrativo — não utilizar com pacientes reais.':'Preencha os dados abaixo e salve a alteração local.'} onClose={()=>setModal(null)} wide={['patient','assessment','evolution','plan','template'].includes(modal.kind)} footer={<><button className="m-btn secondary" onClick={()=>setModal(null)}>Cancelar</button><button className="m-btn primary" onClick={saveForm}><Check size={17}/> Salvar {modal.kind==='payment'?'pagamento':'alterações'}</button></>}>
  <Inputs fields={kindFields} form={form} onChange={updateForm}/>
  {modal.kind==='appointment'&&<div className="m-form-context"><CalendarDays size={17}/><div><strong>{serviceName(db,form.serviceId)}</strong><span>Duração: {db.services.find(s=>s.id===form.serviceId)?.duration||50} minutos. O sistema bloqueia colisões demonstrativas de horários.</span></div></div>}
  {modal.kind==='template'&&<div className="m-question-builder"><div className="m-builder-header"><h3>Perguntas do formulário</h3><button className="m-btn secondary" onClick={()=>updateForm('questions',[...(form.questions||[]),{id:uid(),label:'',kind:'Texto',required:false,options:''}])}><Plus size={15}/> Nova pergunta</button></div>
   {(!form.questions||form.questions.length===0)?<Empty title="Formulário sem perguntas" description="Adicione a primeira pergunta ao modelo. Para salvar, é necessário pelo menos um campo."/>:(form.questions as TemplateQuestion[]).map((q,i)=><div className="m-builder-item" key={q.id}><div className="m-builder-item-top"><strong>Pergunta {i+1}</strong><button className="m-icon-btn" title="Remover pergunta" onClick={()=>updateForm('questions',(form.questions as TemplateQuestion[]).filter(v=>v.id!==q.id))}><Trash2 size={16}/></button></div><div className="m-form-grid"><label className="m-field span-2"><span className="m-field-label">Enunciado</span><input value={q.label} placeholder="Digite a pergunta" onChange={e=>updateForm('questions',(form.questions as TemplateQuestion[]).map(x=>x.id===q.id?{...x,label:e.target.value}:x))}/></label><label className="m-field"><span className="m-field-label">Tipo de resposta</span><select value={q.kind} onChange={e=>updateForm('questions',(form.questions as TemplateQuestion[]).map(x=>x.id===q.id?{...x,kind:e.target.value}:x))}>{['Texto','Texto longo','Número','Data','Seleção','Sim/Não'].map(v=><option key={v}>{v}</option>)}</select></label><label className="m-field"><span className="m-field-label">Obrigatória?</span><span className="m-checkline"><input type="checkbox" checked={q.required} onChange={e=>updateForm('questions',(form.questions as TemplateQuestion[]).map(x=>x.id===q.id?{...x,required:e.target.checked}:x))}/> Exigir resposta</span></label>{q.kind==='Seleção'&&<label className="m-field span-2"><span className="m-field-label">Opções separadas por vírgula</span><input value={q.options} onChange={e=>updateForm('questions',(form.questions as TemplateQuestion[]).map(x=>x.id===q.id?{...x,options:e.target.value}:x))}/></label>}</div></div>)}
  </div>}
  {formError&&<ErrorNote message={formError}/>}
  <Hint>As informações são armazenadas apenas na demonstração local do navegador. Não use dados pessoais reais.</Hint>
 </Dialog>
 const contentMap:Record<Page,ReactNode>={dashboard,patients:patientsPage,therapists:therapistsPage,services:servicesPage,appointments:appointmentsPage,assessments:assessmentsPage,plans:plansPage,evolutions:evolutionsPage,finance:financePage,templates:templatesPage,users:usersPage,settings:settingsPage}
 return <div className="m-app">
  <aside className={'m-sidebar'+(mobileOpen?' mobile-open':'')}>
   <div className="m-brand"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-ZP3ju3ZQmlJMtEYGFpDaiZmgYzjay3.png" alt="Símbolo do Instituto Muraro"/><div><strong>Instituto Muraro</strong><span>Gestão em fisioterapia</span></div><button className="m-icon-btn sidebar-close" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><X size={19}/></button></div>
   <nav className="m-sidebar-nav" aria-label="Menu principal"><span className="m-nav-label">PRINCIPAL</span>{menuItems.slice(0,5).map(({id,icon:Icon})=><button key={id} className={'m-nav-link'+(page===id?' active':'')} onClick={()=>navigate(id)}><Icon size={19}/><span>{pageNames[id]}</span>{page===id&&<span className="m-nav-active-dot"/>}</button>)}
   <span className="m-nav-label second">GESTÃO CLÍNICA</span>{menuItems.slice(5,8).map(({id,icon:Icon})=><button key={id} className={'m-nav-link'+(page===id?' active':'')} onClick={()=>navigate(id)}><Icon size={19}/><span>{pageNames[id]}</span>{page===id&&<span className="m-nav-active-dot"/>}</button>)}
   <span className="m-nav-label second">ADMINISTRAÇÃO</span>{menuItems.slice(8).map(({id,icon:Icon})=><button key={id} className={'m-nav-link'+(page===id?' active':'')} onClick={()=>navigate(id)}><Icon size={19}/><span>{pageNames[id]}</span>{page===id&&<span className="m-nav-active-dot"/>}</button>)}
   </nav>
   <div className="m-sidebar-bottom"><div className="m-demo-label"><span className="m-demo-glow"/> <div><strong>Modo demonstração</strong><small>Dados fictícios · não usar clinicamente</small></div></div><div className="m-sidebar-user"><Avatar size="small" name="Equipe Muraro"/><span><strong>Equipe Muraro</strong><small>Ambiente local</small></span><MoreHorizontal size={18}/></div></div>
  </aside>
  {mobileOpen&&<button className="m-mobile-backdrop" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"/>}
  <div className="m-main">
   <header className="m-topbar"><button className="m-mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Menu size={22}/></button><div className="m-breadcrumb"><span>Instituto Muraro</span><span className="m-breadcrumb-sep">/</span><strong>{pageNames[page]}</strong></div><div className="m-topbar-actions"><span className="m-online"><i/> Demo local</span><button className="m-help-btn" title="Esta é uma demonstração sem prontuário seguro" onClick={()=>notify('Sistema de demonstração: não utilize dados reais de pacientes.')}><CircleHelp size={19}/></button><div className="m-top-avatar">EM</div></div></header>
   <main className="m-main-inner">{contentMap[page]}</main>
   <footer className="m-footer">Instituto Muraro · Interface demonstrativa de fisioterapia <span>Desenvolvimento ETH Tecnologia</span></footer>
  </div>
  {notice&&<div className="m-toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button title="Fechar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
  {patientDetail}
  {templatePreview}
  {formModal}
 </div>
}
