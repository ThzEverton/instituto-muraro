import { Prisma, type TipoComunicacao, type MensagemComunicacao } from '@prisma/client'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { dataLocal, inicioDiaLocal } from '../agenda/agenda.validacao.js'

export const tiposAgenda:TipoComunicacao[]=['CONFIRMACAO_AGENDA','LEMBRETE_AGENDA']
export function telefoneWhatsApp(valor:string|null) {
  const n=(valor??'').replace(/\D/g,'')
  if(n.length===10||n.length===11)return '55'+n
  if((n.length===12||n.length===13)&&n.startsWith('55'))return n
  return null
}
function autorizado(p:{ativo:boolean;whatsapp:string|null;whatsappAutorizado:string|null;autorizadoWhatsAppEm:Date|null}) {
  return p.ativo&&!!p.autorizadoWhatsAppEm&&!!telefoneWhatsApp(p.whatsapp)&&telefoneWhatsApp(p.whatsapp)===p.whatsappAutorizado
}
const dataCivil=(d:Date)=>d.toISOString().slice(0,10)
const somar=(d:string,n:number)=>dataCivil(new Date(Date.parse(d)+n*86400000))
const dataBr=(s:string)=>s.slice(0,10).split('-').reverse().join('/')
const horario=(s:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(s))
const pacienteAutorizado={ativo:true,autorizadoWhatsAppEm:{not:null},whatsappAutorizado:{not:null}} satisfies Prisma.PacienteWhereInput
const abertas=['AGENDADO','AGUARDANDO_CONFIRMACAO','CONFIRMADO'] as const
type Candidato={tipo:TipoComunicacao;pacienteId:string;referenciaId:string;referenciaData:string}
export async function gerarFilaComunicacao(apenasAgenda=false,agora=new Date()) {
  const hoje=dataLocal(agora).data
  return prisma.$transaction(async t=>{
    const regras=await t.regraComunicacao.findMany({where:{ativa:true,...(apenasAgenda?{tipo:{in:tiposAgenda}}:{})}})
    let criadas=0
    for(const regra of regras){
      const fim=somar(hoje,regra.antecedenciaDias), candidatos:Candidato[]=[]
      if(tiposAgenda.includes(regra.tipo)){
        const itens=await t.agendamento.findMany({where:{inicioEm:{gte:agora,lt:inicioDiaLocal(somar(fim,1))},situacao:{in:regra.tipo==='CONFIRMACAO_AGENDA'?['AGENDADO','AGUARDANDO_CONFIRMACAO']:[...abertas]},paciente:pacienteAutorizado},include:{paciente:true}})
        for(const a of itens)if(autorizado(a.paciente))candidatos.push({tipo:regra.tipo,pacienteId:a.pacienteId,referenciaId:a.id,referenciaData:a.inicioEm.toISOString()})
      }else if(regra.tipo==='COBRANCA'){
        const itens=await t.cobranca.findMany({where:{vencimentoEm:{gte:new Date(hoje),lte:new Date(fim)},situacao:{notIn:['CANCELADA','ESTORNADA']},paciente:pacienteAutorizado},include:{paciente:true,recebimentos:{where:{estornadoEm:null}}}})
        for(const b of itens)if(autorizado(b.paciente)&&b.recebimentos.reduce((s,r)=>s+r.valorCentavos,0)<b.valorCentavos)candidatos.push({tipo:regra.tipo,pacienteId:b.pacienteId,referenciaId:b.id,referenciaData:dataCivil(b.vencimentoEm)})
      }else{
        const itens=await t.contratoPlano.findMany({where:{fimEm:{gte:new Date(hoje),lte:new Date(fim)},renovacao:null,paciente:pacienteAutorizado},include:{paciente:true}})
        for(const c of itens)if(autorizado(c.paciente))candidatos.push({tipo:regra.tipo,pacienteId:c.pacienteId,referenciaId:c.id,referenciaData:dataCivil(c.fimEm)})
      }
      // Chave unica evita duplicidade mesmo em execucoes simultaneas.
      for(let i=0;i<candidatos.length;i+=100){
        const dados=candidatos.slice(i,i+100).map(c=>({...c,chave:[c.tipo,c.referenciaId,c.referenciaData].join(':')}))
        criadas+=(await t.mensagemComunicacao.createMany({data:dados,skipDuplicates:true})).count
      }
    }
    return {criadas}
  },{timeout:30000})
}
export async function prepararMensagem(t:Prisma.TransactionClient,item:MensagemComunicacao,agora=new Date()) {
  if(item.situacao!=='PENDENTE')return null
  const [p,regra,config]=await Promise.all([t.paciente.findUnique({where:{id:item.pacienteId}}),t.regraComunicacao.findUnique({where:{tipo:item.tipo}}),t.configuracaoClinica.findUnique({where:{id:'clinica'}})])
  if(!p||!autorizado(p)||!regra?.ativa)return null
  let dia=item.referenciaData, hora=''
  if(tiposAgenda.includes(item.tipo)){
    const a=await t.agendamento.findUnique({where:{id:item.referenciaId}})
    if(!a||a.pacienteId!==p.id||a.inicioEm.toISOString()!==item.referenciaData||a.inicioEm<=agora||!(abertas as readonly string[]).includes(a.situacao)||(item.tipo==='CONFIRMACAO_AGENDA'&&a.situacao==='CONFIRMADO'))return null
    dia=dataLocal(a.inicioEm).data;hora=horario(item.referenciaData)
  }else if(item.tipo==='COBRANCA'){
    const b=await t.cobranca.findUnique({where:{id:item.referenciaId},include:{recebimentos:{where:{estornadoEm:null}}}})
    if(!b||b.pacienteId!==p.id||dataCivil(b.vencimentoEm)!==dia||['CANCELADA','ESTORNADA'].includes(b.situacao)||b.recebimentos.reduce((s,r)=>s+r.valorCentavos,0)>=b.valorCentavos)return null
  }else{
    const c=await t.contratoPlano.findUnique({where:{id:item.referenciaId},include:{renovacao:{select:{id:true}}}})
    if(!c||c.pacienteId!==p.id||dataCivil(c.fimEm)!==dia||c.renovacao)return null
  }
  const hoje=dataLocal(agora).data
  if(dia<hoje||dia>somar(hoje,regra.antecedenciaDias))return null
  const variaveis:Record<string,string>={nome:p.nomeCompleto.split(/\s+/)[0],data:dataBr(dia),hora,clinica:config?.nome??'Instituto Muraro'}
  const mensagem=regra.mensagem.replace(/\{([^}]+)\}/g,(_,k:string)=>variaveis[k]??'')
  return {telefone:telefoneWhatsApp(p.whatsapp)!,mensagem}
}
