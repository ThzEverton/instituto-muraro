import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis,type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { gerarFilaComunicacao,prepararMensagem,telefoneWhatsApp,tiposAgenda } from './comunicacao.servico.js'
import * as v from './comunicacao.validacao.js'
const equipe=exigirPerfis(['ADMINISTRADOR','RECEPCAO'])
const admin=exigirPerfis(['ADMINISTRADOR'])
export async function registrarRotasComunicacao(app:FastifyInstance){
  app.get('/api/v1/comunicacao/regras',{preHandler:admin},async()=>({dados:await prisma.regraComunicacao.findMany({orderBy:{tipo:'asc'}})}))
  app.patch('/api/v1/comunicacao/regras/:tipo',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const tipo=v.tipo.safeParse((req.params as {tipo:string}).tipo),r=v.regra.safeParse(req.body)
    if(!tipo.success||!r.success)return res.code(400).send({erro:'Regra inválida'})
    const dados=await prisma.$transaction(async t=>{
      const item=await t.regraComunicacao.upsert({where:{tipo:tipo.data},create:{tipo:tipo.data,...r.data},update:r.data})
      await t.registroAuditoria.create({data:{usuarioId:req.identidade!.id,acao:'ATUALIZAR',entidade:'regra_comunicacao',entidadeId:item.tipo}})
      return item
    })
    return {dados}
  })
  app.patch('/api/v1/comunicacao/pacientes/:id/autorizacao',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    const {id}=req.params as {id:string},r=v.autorizacao.safeParse(req.body)
    if(!r.success)return res.code(400).send({erro:'Autorização inválida'})
    const dados=await prisma.$transaction(async t=>{
      await t.$queryRaw`SELECT id FROM pacientes WHERE id = ${id} FOR UPDATE`
      const p=await t.paciente.findUnique({where:{id}})
      if(!p)return null
      const telefone=telefoneWhatsApp(p.whatsapp)
      if(r.data.aceita&&(!p.ativo||!telefone))return false
      const item=await t.paciente.update({where:{id},data:{whatsappAutorizado:r.data.aceita?telefone:null,autorizadoWhatsAppEm:r.data.aceita?new Date():null},select:{id:true,whatsappAutorizado:true,autorizadoWhatsAppEm:true}})
      await t.registroAuditoria.create({data:{usuarioId:req.identidade!.id,acao:r.data.aceita?'AUTORIZAR_WHATSAPP':'REVOGAR_WHATSAPP',entidade:'paciente',entidadeId:id}})
      return item
    })
    if(dados===null)return res.code(404).send({erro:'Paciente inexistente'})
    if(dados===false)return res.code(400).send({erro:'Paciente ativo e WhatsApp brasileiro válido são necessários'})
    return {dados}
  })
  app.post('/api/v1/comunicacao/gerar',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    if(!v.gerar.safeParse(req.body??{}).success)return res.code(400).send({erro:'Dados inválidos'})
    const dados=await gerarFilaComunicacao(req.identidade!.perfil==='RECEPCAO')
    return {dados}
  })
  app.get('/api/v1/comunicacao/fila',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    const r=v.consulta.safeParse(req.query)
    if(!r.success)return res.code(400).send({erro:'Consulta inválida'})
    const where={situacao:r.data.situacao,...(req.identidade!.perfil==='RECEPCAO'?{tipo:{in:tiposAgenda}}:{})}
    const [total,dados]=await prisma.$transaction([prisma.mensagemComunicacao.count({where}),prisma.mensagemComunicacao.findMany({where,select:{id:true,tipo:true,pacienteId:true,referenciaData:true,situacao:true,criadaEm:true,enviadaEm:true,canceladaEm:true,paciente:{select:{nomeCompleto:true}}},orderBy:{criadaEm:'desc'},skip:(r.data.pagina-1)*50,take:50})])
    return {dados,total}
  })
  app.post('/api/v1/comunicacao/fila/:id/preparar',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    const {id}=req.params as {id:string}
    const dados=await prisma.$transaction(async t=>{
      const item=await t.mensagemComunicacao.findUnique({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      const mensagem=await prepararMensagem(t,item)
      if(!mensagem)return false
      await t.registroAuditoria.create({data:{usuarioId:req.identidade!.id,acao:'PREPARAR_ENVIO_MANUAL',entidade:'mensagem_comunicacao',entidadeId:id}})
      return mensagem
    })
    if(dados===null)return res.code(404).send({erro:'Mensagem inexistente'})
    if(dados===false)return res.code(409).send({erro:'Mensagem indisponível: confira autorização, regra e situação do atendimento ou cobrança'})
    return {dados}
  })
  app.patch('/api/v1/comunicacao/fila/:id/enviada',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    const {id}=req.params as {id:string}
    const dados=await prisma.$transaction(async t=>{
      const item=await t.mensagemComunicacao.findUnique({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      if(!await prepararMensagem(t,item))return false
      const alterado=await t.mensagemComunicacao.updateMany({where:{id,situacao:'PENDENTE'},data:{situacao:'ENVIADA_MANUALMENTE',enviadaEm:new Date()}})
      if(!alterado.count)return false
      await t.registroAuditoria.create({data:{usuarioId:req.identidade!.id,acao:'CONFIRMAR_ENVIO_MANUAL',entidade:'mensagem_comunicacao',entidadeId:id}})
      return {id,situacao:'ENVIADA_MANUALMENTE'}
    })
    if(dados===null)return res.code(404).send({erro:'Mensagem inexistente'})
    if(dados===false)return res.code(409).send({erro:'Mensagem não está mais disponível'})
    return {dados}
  })
  app.patch('/api/v1/comunicacao/fila/:id/cancelar',{preHandler:equipe},async(req:RequisicaoAutenticada,res)=>{
    const {id}=req.params as {id:string}
    const dados=await prisma.$transaction(async t=>{
      const item=await t.mensagemComunicacao.findUnique({where:{id}})
      if(!item||req.identidade!.perfil==='RECEPCAO'&&!tiposAgenda.includes(item.tipo))return null
      const alterado=await t.mensagemComunicacao.updateMany({where:{id,situacao:'PENDENTE'},data:{situacao:'CANCELADA',canceladaEm:new Date()}})
      if(!alterado.count)return false
      await t.registroAuditoria.create({data:{usuarioId:req.identidade!.id,acao:'CANCELAR',entidade:'mensagem_comunicacao',entidadeId:id}})
      return {id,situacao:'CANCELADA'}
    })
    if(dados===null)return res.code(404).send({erro:'Mensagem inexistente'})
    if(dados===false)return res.code(409).send({erro:'Mensagem já processada'})
    return {dados}
  })
}
