import { travarPaciente as travarRegistroPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioCobranca } from '../repositorios/cobranca.repositorio.js'
import { repositorioConfiguracaoClinica } from '../repositorios/configuracao-clinica.repositorio.js'
import { repositorioContratoPlano } from '../repositorios/contrato-plano.repositorio.js'
import { repositorioMensagemComunicacao } from '../repositorios/mensagem-comunicacao.repositorio.js'
import { repositorioPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioRegraComunicacao } from '../repositorios/regra-comunicacao.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma, type TipoComunicacao, type MensagemComunicacao } from '@prisma/client'
import { dataLocal, inicioDiaLocal } from '../validacoes/agenda.validacao.js'
import * as v from '../validacoes/comunicacao.validacao.js'

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
  return emTransacao(async t=>{
    const regras=await repositorioRegraComunicacao(t).listar({where:{ativa:true,...(apenasAgenda?{tipo:{in:tiposAgenda}}:{})}})
    let criadas=0
    for(const regra of regras){
      const fim=somar(hoje,regra.antecedenciaDias), candidatos:Candidato[]=[]
      if(tiposAgenda.includes(regra.tipo)){
        const itens=await repositorioAgendamento(t).listar({where:{inicioEm:{gte:agora,lt:inicioDiaLocal(somar(fim,1))},situacao:{in:regra.tipo==='CONFIRMACAO_AGENDA'?['AGENDADO','AGUARDANDO_CONFIRMACAO']:[...abertas]},paciente:pacienteAutorizado},include:{paciente:true}})
        for(const a of itens)if(autorizado(a.paciente))candidatos.push({tipo:regra.tipo,pacienteId:a.pacienteId,referenciaId:a.id,referenciaData:a.inicioEm.toISOString()})
      }else if(regra.tipo==='COBRANCA'){
        const itens=await repositorioCobranca(t).listar({where:{vencimentoEm:{gte:new Date(hoje),lte:new Date(fim)},situacao:{notIn:['CANCELADA','ESTORNADA']},paciente:pacienteAutorizado},include:{paciente:true,recebimentos:{where:{estornadoEm:null}}}})
        for(const b of itens)if(autorizado(b.paciente)&&b.recebimentos.reduce((s,r)=>s+r.valorCentavos,0)<b.valorCentavos)candidatos.push({tipo:regra.tipo,pacienteId:b.pacienteId,referenciaId:b.id,referenciaData:dataCivil(b.vencimentoEm)})
      }else{
        const itens=await repositorioContratoPlano(t).listar({where:{fimEm:{gte:new Date(hoje),lte:new Date(fim)},renovacao:null,paciente:pacienteAutorizado},include:{paciente:true}})
        for(const c of itens)if(autorizado(c.paciente))candidatos.push({tipo:regra.tipo,pacienteId:c.pacienteId,referenciaId:c.id,referenciaData:dataCivil(c.fimEm)})
      }
      // Chave unica evita duplicidade mesmo em execucoes simultaneas.
      for(let i=0;i<candidatos.length;i+=100){
        const dados=candidatos.slice(i,i+100).map(c=>({...c,chave:[c.tipo,c.referenciaId,c.referenciaData].join(':')}))
        criadas+=(await repositorioMensagemComunicacao(t).criarVarios({data:dados,skipDuplicates:true})).count
      }
    }
    return {criadas}
  },{timeout:30000})
}

export async function prepararMensagem(t:Prisma.TransactionClient,item:MensagemComunicacao,agora=new Date()) {
  if(item.situacao!=='PENDENTE')return null
  const [p,regra,config]=await Promise.all([repositorioPaciente(t).buscarUnico({where:{id:item.pacienteId}}),repositorioRegraComunicacao(t).buscarUnico({where:{tipo:item.tipo}}),repositorioConfiguracaoClinica(t).buscarUnico({where:{id:'clinica'}})])
  if(!p||!autorizado(p)||!regra?.ativa)return null
  let dia=item.referenciaData, hora=''
  if(tiposAgenda.includes(item.tipo)){
    const a=await repositorioAgendamento(t).buscarUnico({where:{id:item.referenciaId}})
    if(!a||a.pacienteId!==p.id||a.inicioEm.toISOString()!==item.referenciaData||a.inicioEm<=agora||!(abertas as readonly string[]).includes(a.situacao)||(item.tipo==='CONFIRMACAO_AGENDA'&&a.situacao==='CONFIRMADO'))return null
    dia=dataLocal(a.inicioEm).data;hora=horario(item.referenciaData)
  }else if(item.tipo==='COBRANCA'){
    const b=await repositorioCobranca(t).buscarUnico({where:{id:item.referenciaId},include:{recebimentos:{where:{estornadoEm:null}}}})
    if(!b||b.pacienteId!==p.id||dataCivil(b.vencimentoEm)!==dia||['CANCELADA','ESTORNADA'].includes(b.situacao)||b.recebimentos.reduce((s,r)=>s+r.valorCentavos,0)>=b.valorCentavos)return null
  }else{
    const c=await repositorioContratoPlano(t).buscarUnico({where:{id:item.referenciaId},include:{renovacao:{select:{id:true}}}})
    if(!c||c.pacienteId!==p.id||dataCivil(c.fimEm)!==dia||c.renovacao)return null
  }
  const hoje=dataLocal(agora).data
  if(dia<hoje||dia>somar(hoje,regra.antecedenciaDias))return null
  const variaveis:Record<string,string>={nome:p.nomeCompleto.split(/\s+/)[0],data:dataBr(dia),hora,clinica:config?.nome??'Instituto Muraro'}
  const mensagem=regra.mensagem.replace(/\{([^}]+)\}/g,(_,k:string)=>variaveis[k]??'')
  return {telefone:telefoneWhatsApp(p.whatsapp)!,mensagem}
}



export async function listarRegras() { return ({dados:await repositorioRegraComunicacao().listar({orderBy:{tipo:'asc'}})}) }

export async function atualizarRegra(req: EntradaOperacao) {
    const tipo=v.tipo.safeParse((req.parametros as {tipo:string}).tipo),r=v.regra.safeParse(req.corpo)
    if(!tipo.success||!r.success)return retornarResultado(400, {erro:'Regra inválida'})
    const dados=await emTransacao(async t=>{
      const item=await repositorioRegraComunicacao(t).criarOuAtualizar({where:{tipo:tipo.data},create:{tipo:tipo.data,...r.data},update:r.data})
      await repositorioRegistroAuditoria(t).criar({data:{usuarioId:req.identidade!.id,acao:'ATUALIZAR',entidade:'regra_comunicacao',entidadeId:item.tipo}})
      return item
    })
    return {dados}
}

export async function atualizarAutorizacaoWhatsApp(req: EntradaOperacao) {
    const {id}=req.parametros as {id:string},r=v.autorizacao.safeParse(req.corpo)
    if(!r.success)return retornarResultado(400, {erro:'Autorização inválida'})
    const dados=await emTransacao(async t=>{
      await travarRegistroPaciente(t, id)
      const p=await repositorioPaciente(t).buscarUnico({where:{id}})
      if(!p)return null
      const telefone=telefoneWhatsApp(p.whatsapp)
      if(r.data.aceita&&(!p.ativo||!telefone))return false
      const item=await repositorioPaciente(t).atualizar({where:{id},data:{whatsappAutorizado:r.data.aceita?telefone:null,autorizadoWhatsAppEm:r.data.aceita?new Date():null},select:{id:true,whatsappAutorizado:true,autorizadoWhatsAppEm:true}})
      await repositorioRegistroAuditoria(t).criar({data:{usuarioId:req.identidade!.id,acao:r.data.aceita?'AUTORIZAR_WHATSAPP':'REVOGAR_WHATSAPP',entidade:'paciente',entidadeId:id}})
      return item
    })
    if(dados===null)return retornarResultado(404, {erro:'Paciente inexistente'})
    if(dados===false)return retornarResultado(400, {erro:'Paciente ativo e WhatsApp brasileiro válido são necessários'})
    return {dados}
}

export async function gerarPendencias(req: EntradaOperacao) {
    if(!v.gerar.safeParse(req.corpo??{}).success)return retornarResultado(400, {erro:'Dados inválidos'})
    const dados=await gerarFilaComunicacao(req.identidade!.perfil==='RECEPCAO')
    return {dados}
}

export async function listarFila(req: EntradaOperacao) {
    const r=v.consulta.safeParse(req.consulta)
    if(!r.success)return retornarResultado(400, {erro:'Consulta inválida'})
    const where={situacao:r.data.situacao,...(req.identidade!.perfil==='RECEPCAO'?{tipo:{in:tiposAgenda}}:{})}
    const [total,dados]=await emTransacao([repositorioMensagemComunicacao().contar({where}),repositorioMensagemComunicacao().listar({where,select:{id:true,tipo:true,pacienteId:true,referenciaData:true,situacao:true,criadaEm:true,enviadaEm:true,canceladaEm:true,paciente:{select:{nomeCompleto:true}}},orderBy:{criadaEm:'desc'},skip:(r.data.pagina-1)*50,take:50})])
    return {dados,total}
}

export async function prepararEnvio(req: EntradaOperacao) {
    const {id}=req.parametros as {id:string}
    const dados=await emTransacao(async t=>{
      const item=await repositorioMensagemComunicacao(t).buscarUnico({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      const mensagem=await prepararMensagem(t,item)
      if(!mensagem)return false
      await repositorioRegistroAuditoria(t).criar({data:{usuarioId:req.identidade!.id,acao:'PREPARAR_ENVIO_MANUAL',entidade:'mensagem_comunicacao',entidadeId:id}})
      return mensagem
    })
    if(dados===null)return retornarResultado(404, {erro:'Mensagem inexistente'})
    if(dados===false)return retornarResultado(409, {erro:'Mensagem indisponível: confira autorização, regra e situação do atendimento ou cobrança'})
    return {dados}
}

export async function registrarEnvio(req: EntradaOperacao) {
    const {id}=req.parametros as {id:string}
    const dados=await emTransacao(async t=>{
      const item=await repositorioMensagemComunicacao(t).buscarUnico({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      if(!await prepararMensagem(t,item))return false
      const alterado=await repositorioMensagemComunicacao(t).atualizarVarios({where:{id,situacao:'PENDENTE'},data:{situacao:'ENVIADA_MANUALMENTE',enviadaEm:new Date()}})
      if(!alterado.count)return false
      await repositorioRegistroAuditoria(t).criar({data:{usuarioId:req.identidade!.id,acao:'CONFIRMAR_ENVIO_MANUAL',entidade:'mensagem_comunicacao',entidadeId:id}})
      return {id,situacao:'ENVIADA_MANUALMENTE'}
    })
    if(dados===null)return retornarResultado(404, {erro:'Mensagem inexistente'})
    if(dados===false)return retornarResultado(409, {erro:'Mensagem não está mais disponível'})
    return {dados}
}

export async function cancelarMensagem(req: EntradaOperacao) {
    const {id}=req.parametros as {id:string}
    const dados=await emTransacao(async t=>{
      const item=await repositorioMensagemComunicacao(t).buscarUnico({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      const alterado=await repositorioMensagemComunicacao(t).atualizarVarios({where:{id,situacao:'PENDENTE'},data:{situacao:'CANCELADA',canceladaEm:new Date()}})
      if(!alterado.count)return false
      await repositorioRegistroAuditoria(t).criar({data:{usuarioId:req.identidade!.id,acao:'CANCELAR',entidade:'mensagem_comunicacao',entidadeId:id}})
      return {id,situacao:'CANCELADA'}
    })
    if(dados===null)return retornarResultado(404, {erro:'Mensagem inexistente'})
    if(dados===false)return retornarResultado(409, {erro:'Mensagem já processada'})
    return {dados}
}
