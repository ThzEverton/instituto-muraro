import type { FastifyInstance, FastifyReply } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { dataLocal } from '../agenda/agenda.validacao.js'
import * as v from './financeiro.validacao.js'

const admin = exigirPerfis(['ADMINISTRADOR'])
const equipe = exigirPerfis(['ADMINISTRADOR','RECEPCAO'])
class ErroFinanceiro extends Error { constructor(public status: number, mensagem: string) { super(mensagem) } }
const falhar = (status:number,mensagem:string):never => {throw new ErroFinanceiro(status,mensagem)}
function tratar(e:unknown,res:FastifyReply) {
  if(e instanceof ErroFinanceiro)return res.code(e.status).send({erro:e.message})
  throw e
}
const data = (d:string) => new Date(d+'T00:00:00Z')
const hoje = () => data(dataLocal(new Date()).data)
const somarDias = (d:Date,n:number) => new Date(d.getTime()+n*86400000)
function mes(d:Date,n:number) {
  const ano=d.getUTCFullYear(), m=d.getUTCMonth()+n, dia=d.getUTCDate()
  return new Date(Date.UTC(ano,m,Math.min(dia,new Date(Date.UTC(ano,m+1,0)).getUTCDate())))
}
const arredondar = (valor:number,pontos:number) => Math.round(valor*pontos/10000)
async function auditar(t:Prisma.TransactionClient,u:string,acao:string,entidade:string,id:string) {
  await t.registroAuditoria.create({data:{usuarioId:u,acao,entidade,entidadeId:id}})
}
// Serialização financeira simples e independente da agenda; operações curtas.
async function transacao<T>(fn:(t:Prisma.TransactionClient)=>Promise<T>) {
  return prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro'), 1)::text`
    return fn(t)
  },{timeout:15000})
}
const incluirContrato = { paciente:{select:{nomeCompleto:true}}, cobrancas:{orderBy:{parcela:'asc' as const}}, _count:{select:{consumos:true}} } as const
const incluirCobranca = { paciente:{select:{nomeCompleto:true}}, recebimentos:{orderBy:{recebidoEm:'desc' as const},include:{comissao:true}} } as const
function contratoComSaldo<T extends {_count:{consumos:number};sessoesContratadas:number}>(c:T) {return {...c,sessoesUtilizadas:c._count.consumos,sessoesRestantes:c.sessoesContratadas-c._count.consumos}}
function situacaoCobranca(c:{valorCentavos:number;vencimentoEm:Date;situacao:string},pago:number) {
  if(c.situacao==='CANCELADA'||c.situacao==='ESTORNADA')return c.situacao
  if(pago===c.valorCentavos)return 'PAGA'
  if(pago>0)return 'PARCIAL'
  return c.vencimentoEm<hoje()?'VENCIDA':'PENDENTE'
}
async function recalcular(t:Prisma.TransactionClient,id:string) {
  const c=await t.cobranca.findUniqueOrThrow({where:{id}})
  const pago=(await t.recebimento.aggregate({where:{cobrancaId:id,estornadoEm:null},_sum:{valorCentavos:true}}))._sum.valorCentavos??0
  const situacao=situacaoCobranca(c,pago) as import('@prisma/client').SituacaoCobranca
  await t.cobranca.update({where:{id},data:{situacao}})
}
function cobrancaComSaldo<T extends {valorCentavos:number;vencimentoEm:Date;situacao:string;recebimentos:{valorCentavos:number;estornadoEm:Date|null}[]}>(c:T) {
  const pago=c.recebimentos.filter(r=>!r.estornadoEm).reduce((s,r)=>s+r.valorCentavos,0)
  return {...c,situacao:situacaoCobranca(c,pago),valorRecebidoCentavos:pago,saldoCentavos:c.situacao==='CANCELADA'?0:c.valorCentavos-pago}
}

export async function registrarRotasFinanceiro(app:FastifyInstance) {
  app.get('/api/v1/financeiro/parcerias',{preHandler:equipe},async()=>({dados:await prisma.parceria.findMany({orderBy:{nome:'asc'},take:500})}))
  app.post('/api/v1/financeiro/parcerias',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.parceria.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Parceria inválida'})
    const dados=await transacao(async t=>{const c=await t.parceria.create({data:r.data});await auditar(t,req.identidade!.id,'CRIAR','parceria',c.id);return c})
    return res.code(201).send({dados})
  })
  app.patch('/api/v1/financeiro/parcerias/:id',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.edicaoParceria.safeParse(req.body);if(!r.success||!Object.keys(r.data).length)return res.code(400).send({erro:'Alteração inválida'})
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{if(!await t.parceria.findUnique({where:{id}}))falhar(404,'Parceria não encontrada');const c=await t.parceria.update({where:{id},data:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','parceria',id);return c})}}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/taxas',{preHandler:admin},async()=>({dados:await prisma.taxaPagamento.findMany({orderBy:{criadaEm:'desc'},take:500})}))
  app.post('/api/v1/financeiro/taxas',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.taxa.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Taxa inválida'})
    const dados=await transacao(async t=>{const c=await t.taxaPagamento.create({data:r.data});await auditar(t,req.identidade!.id,'CRIAR_VERSAO','taxa_pagamento',c.id);return c})
    return res.code(201).send({dados})
  })
  app.get('/api/v1/financeiro/planos',{preHandler:equipe},async()=>({dados:await prisma.planoTratamento.findMany({orderBy:{nome:'asc'},take:500})}))
  app.post('/api/v1/financeiro/planos',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.plano.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Plano inválido'})
    try{const dados=await transacao(async t=>{if(!(await t.servico.findUnique({where:{id:r.data.servicoId}}))?.ativo)falhar(400,'Serviço indisponível');const c=await t.planoTratamento.create({data:r.data});await auditar(t,req.identidade!.id,'CRIAR','plano_tratamento',c.id);return c});return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.patch('/api/v1/financeiro/planos/:id',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.edicaoPlano.safeParse(req.body);if(!r.success||!Object.keys(r.data).length)return res.code(400).send({erro:'Alteração inválida'})
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{if(!await t.planoTratamento.findUnique({where:{id}}))falhar(404,'Plano não encontrado');if(r.data.servicoId&&!(await t.servico.findUnique({where:{id:r.data.servicoId}}))?.ativo)falhar(400,'Serviço indisponível');const c=await t.planoTratamento.update({where:{id},data:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','plano_tratamento',id);return c})}}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/contratos',{preHandler:admin},async(req,res)=>{
    const r=v.consultaContratos.safeParse(req.query);if(!r.success)return res.code(400).send({erro:'Consulta inválida'})
    const where={...(r.data.pacienteId?{pacienteId:r.data.pacienteId}:{})}
    const [total,items]=await prisma.$transaction([prisma.contratoPlano.count({where}),prisma.contratoPlano.findMany({where,include:incluirContrato,orderBy:{criadoEm:'desc'},skip:(r.data.pagina-1)*50,take:50})])
    return {dados:items.map(contratoComSaldo),total}
  })
  app.post('/api/v1/financeiro/contratos',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.contrato.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Contrato inválido'})
    try{const dados=await transacao(async t=>{
      const d=r.data
      const [plano,paciente,parceria,anterior]=await Promise.all([
        t.planoTratamento.findUnique({where:{id:d.planoId},include:{servico:true}}),t.paciente.findUnique({where:{id:d.pacienteId}}),
        d.parceriaId?t.parceria.findUnique({where:{id:d.parceriaId}}):null,d.renovacaoDeId?t.contratoPlano.findUnique({where:{id:d.renovacaoDeId}}):null])
      if(!plano?.ativo||!plano.servico.ativo||!paciente?.ativo||(d.parceriaId&&!parceria?.ativo))return falhar(400,'Plano, paciente ou parceria indisponível')
      const inicio=data(d.inicioEm), fim=somarDias(inicio,plano.validadeDias-1)
      if(d.renovacaoDeId&&(!anterior||anterior.pacienteId!==d.pacienteId||anterior.servicoId!==plano.servicoId||inicio<=anterior.fimEm))return falhar(400,'Renovação deve ser do mesmo paciente e serviço após o término')
      if(data(d.primeiroVencimento)<inicio)return falhar(400,'Primeiro vencimento anterior ao início')
      const desconto=parceria?.descontoPontosBase??0, valor=plano.valorCentavos-arredondar(plano.valorCentavos,desconto)
      if(valor<d.quantidadeParcelas)return falhar(400,'Valor insuficiente para a quantidade de parcelas')
      const base=Math.floor(valor/d.quantidadeParcelas),resto=valor%d.quantidadeParcelas
      const c=await t.contratoPlano.create({data:{chaveOperacao:d.chaveOperacao,pacienteId:d.pacienteId,planoId:d.planoId,parceriaId:d.parceriaId,renovacaoDeId:d.renovacaoDeId,nomePlano:plano.nome,servicoId:plano.servicoId,modalidade:plano.modalidade,sessoesContratadas:plano.sessoes,valorOriginalCentavos:plano.valorCentavos,descontoPontosBase:desconto,valorFinalCentavos:valor,quantidadeParcelas:d.quantidadeParcelas,inicioEm:inicio,fimEm:fim,cobrancas:{create:Array.from({length:d.quantidadeParcelas},(_,i)=>({pacienteId:d.pacienteId,descricao:plano.nome+' - parcela '+(i+1)+'/'+d.quantidadeParcelas,parcela:i+1,valorCentavos:base+(i<resto?1:0),vencimentoEm:mes(data(d.primeiroVencimento),i)}))}},include:incluirContrato})
      await auditar(t,req.identidade!.id,d.renovacaoDeId?'RENOVAR':'CONTRATAR','contrato_plano',c.id)
      return contratoComSaldo(c)
    });return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.post('/api/v1/financeiro/consumos',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.consumo.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Consumo inválido'})
    try{const dados=await transacao(async t=>{
      await t.$queryRaw`SELECT id FROM agendamentos WHERE id = ${r.data.agendamentoId} FOR UPDATE`
      const a=await t.agendamento.findUnique({where:{id:r.data.agendamentoId}}),c=await t.contratoPlano.findUnique({where:{id:r.data.contratoId},include:{_count:{select:{consumos:true}}}})
      if(!a||!c||a.situacao!=='CONCLUIDO'||a.pacienteId!==c.pacienteId||a.servicoId!==c.servicoId)return falhar(400,'Atendimento concluído do mesmo paciente e serviço é obrigatório')
      const dia=data(dataLocal(a.inicioEm).data)
      if(dia<c.inicioEm||dia>c.fimEm||c._count.consumos>=c.sessoesContratadas)return falhar(409,'Contrato fora da validade ou sem sessões')
      const item=await t.consumoSessao.create({data:r.data})
      await auditar(t,req.identidade!.id,'CONSUMIR','consumo_sessao',item.id);return item
    });return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/cobrancas',{preHandler:admin},async(req,res)=>{
    const r=v.consultaCobrancas.safeParse(req.query);if(!r.success)return res.code(400).send({erro:'Consulta inválida'})
    const where={...(r.data.pacienteId?{pacienteId:r.data.pacienteId}:{})}
    const [total,items]=await prisma.$transaction([prisma.cobranca.count({where}),prisma.cobranca.findMany({where,include:incluirCobranca,orderBy:[{vencimentoEm:'desc'},{id:'desc'}],skip:(r.data.pagina-1)*50,take:50})])
    return {dados:items.map(cobrancaComSaldo),total}
  })
  app.post('/api/v1/financeiro/cobrancas',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.cobranca.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Cobrança inválida'})
    try{const dados=await transacao(async t=>{if(!(await t.paciente.findUnique({where:{id:r.data.pacienteId}}))?.ativo)falhar(400,'Paciente indisponível');const c=await t.cobranca.create({data:{...r.data,vencimentoEm:data(r.data.vencimentoEm)},include:incluirCobranca});await auditar(t,req.identidade!.id,'CRIAR','cobranca',c.id);return cobrancaComSaldo(c)});return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.patch('/api/v1/financeiro/cobrancas/:id/cancelar',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.motivo.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Informe motivo'})
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{
      const c=await t.cobranca.findUnique({where:{id},include:incluirCobranca});if(!c)return falhar(404,'Cobrança inexistente')
      if(c.situacao==='CANCELADA'||c.recebimentos.some(x=>!x.estornadoEm))return falhar(409,'Estorne os recebimentos antes de cancelar')
      const item=await t.cobranca.update({where:{id},data:{situacao:'CANCELADA',motivoCancelamento:r.data.motivo},include:incluirCobranca})
      await auditar(t,req.identidade!.id,'CANCELAR','cobranca',id);return cobrancaComSaldo(item)
    })}}catch(e){return tratar(e,res)}
  })
  app.post('/api/v1/financeiro/cobrancas/:id/recebimentos',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.recebimento.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Recebimento inválido'})
    const {id}=req.params as {id:string}
    try{const dados=await transacao(async t=>{
      const c=await t.cobranca.findUnique({where:{id},include:incluirCobranca})
      if(!c)return falhar(404,'Cobrança inexistente')
      if(c.situacao==='CANCELADA'||c.situacao==='ESTORNADA'||r.data.valorCentavos>cobrancaComSaldo(c).saldoCentavos)return falhar(409,'Cobrança encerrada ou valor maior que saldo')
      const taxa=r.data.taxaId?await t.taxaPagamento.findUnique({where:{id:r.data.taxaId}}):null
      if(r.data.taxaId&&(!taxa||taxa.formaPagamento!==r.data.formaPagamento||taxa.parcelas!==r.data.parcelas))return falhar(400,'Taxa incompatível')
      const pontos=taxa?.pontosBase??0
      const item=await t.recebimento.create({data:{...r.data,cobrancaId:id,taxaPontosBase:pontos,taxaCentavos:arredondar(r.data.valorCentavos,pontos)}})
      await recalcular(t,id);await auditar(t,req.identidade!.id,'RECEBER','recebimento',item.id);return item
    });return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.patch('/api/v1/financeiro/recebimentos/:id/estornar',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.motivo.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Informe motivo'})
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{
      const atual=await t.recebimento.findUnique({where:{id},include:{comissao:true}})
      if(!atual)return falhar(404,'Recebimento inexistente')
      if(atual.estornadoEm||atual.comissao?.pagaEm)return falhar(409,'Recebimento estornado ou comissão já paga')
      const instante=new Date()
      if(atual.comissao&&!atual.comissao.canceladaEm){await t.comissao.update({where:{id:atual.comissao.id},data:{canceladaEm:instante}});await auditar(t,req.identidade!.id,'CANCELAR','comissao',atual.comissao.id)}
      const item=await t.recebimento.update({where:{id},data:{estornadoEm:instante,motivoEstorno:r.data.motivo}})
      await recalcular(t,item.cobrancaId);await auditar(t,req.identidade!.id,'ESTORNAR','recebimento',id);return item
    })}}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/despesas',{preHandler:admin},async(req,res)=>{
    const r=v.consultaPeriodo.safeParse(req.query);if(!r.success)return res.code(400).send({erro:'Período inválido'})
    return {dados:await prisma.despesa.findMany({where:{ocorridaEm:{gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}},orderBy:{ocorridaEm:'desc'},take:500})}
  })
  app.post('/api/v1/financeiro/despesas',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.despesa.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Despesa inválida'})
    const dados=await transacao(async t=>{const c=await t.despesa.create({data:{...r.data,ocorridaEm:data(r.data.ocorridaEm)}});await auditar(t,req.identidade!.id,'CRIAR','despesa',c.id);return c})
    return res.code(201).send({dados})
  })
  app.patch('/api/v1/financeiro/despesas/:id/estornar',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.motivo.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Informe motivo'})
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{const atual=await t.despesa.findUnique({where:{id}});if(!atual)return falhar(404,'Despesa inexistente');if(atual.estornadaEm)return falhar(409,'Despesa já estornada');const c=await t.despesa.update({where:{id},data:{estornadaEm:new Date(),motivoEstorno:r.data.motivo}});await auditar(t,req.identidade!.id,'ESTORNAR','despesa',id);return c})}}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/comissoes',{preHandler:admin},async(req,res)=>{
    const r=v.consultaPeriodo.safeParse(req.query);if(!r.success)return res.code(400).send({erro:'Período inválido'})
    return {dados:await prisma.comissao.findMany({where:{criadaEm:{gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}},orderBy:{criadaEm:'desc'},take:500})}
  })
  app.post('/api/v1/financeiro/comissoes',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.comissao.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Comissão inválida'})
    try{const dados=await transacao(async t=>{
      const [recebido,profissional]=await Promise.all([t.recebimento.findUnique({where:{id:r.data.recebimentoId}}),t.profissional.findUnique({where:{id:r.data.profissionalId}})])
      if(!recebido||recebido.estornadoEm||!profissional?.ativo)return falhar(400,'Recebimento ou profissional indisponível')
      const baseCentavos=recebido.valorCentavos-recebido.taxaCentavos
      const valorCentavos=arredondar(baseCentavos,r.data.pontosBase)
      if(!valorCentavos)return falhar(400,'Comissão menor que um centavo')
      const item=await t.comissao.create({data:{...r.data,baseCentavos,valorCentavos}})
      await auditar(t,req.identidade!.id,'CRIAR','comissao',item.id);return item
    });return res.code(201).send({dados})}catch(e){return tratar(e,res)}
  })
  app.patch('/api/v1/financeiro/comissoes/:id/pagar',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const {id}=req.params as {id:string}
    try{return {dados:await transacao(async t=>{const c=await t.comissao.findUnique({where:{id}});if(!c)return falhar(404,'Comissão inexistente');if(c.pagaEm||c.canceladaEm)return falhar(409,'Comissão já paga ou cancelada');const item=await t.comissao.update({where:{id},data:{pagaEm:new Date()}});await auditar(t,req.identidade!.id,'PAGAR','comissao',id);return item})}}catch(e){return tratar(e,res)}
  })
  app.get('/api/v1/financeiro/relatorio',{preHandler:admin},async(req,res)=>{
    const r=v.consultaPeriodo.safeParse(req.query);if(!r.success)return res.code(400).send({erro:'Período inválido'})
    // Recebimentos/estornos em fuso de São Paulo; despesas registradas por data civil.
    const civil={gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}
    const real={gte:new Date(r.data.inicio+'T00:00:00-03:00'),lt:new Date(somarDias(data(r.data.fim),1).toISOString().slice(0,10)+'T00:00:00-03:00')}
    const dados=await transacao(async t=>{
      const [entradas,estornos,despesas,despesasEstornadas,comissoes,cobrancas]=await Promise.all([
        t.recebimento.aggregate({where:{recebidoEm:real},_sum:{valorCentavos:true,taxaCentavos:true}}),
        t.recebimento.aggregate({where:{estornadoEm:real},_sum:{valorCentavos:true,taxaCentavos:true}}),
        t.despesa.aggregate({where:{ocorridaEm:civil},_sum:{valorCentavos:true}}),
        t.despesa.aggregate({where:{estornadaEm:real},_sum:{valorCentavos:true}}),
        t.comissao.aggregate({where:{pagaEm:real},_sum:{valorCentavos:true}}),
        t.cobranca.findMany({where:{vencimentoEm:civil,situacao:{notIn:['CANCELADA','ESTORNADA']}},select:{valorCentavos:true,vencimentoEm:true,situacao:true,recebimentos:{where:{estornadoEm:null},select:{valorCentavos:true,estornadoEm:true}}}})
      ])
      const bruto=entradas._sum.valorCentavos??0, estornado=estornos._sum.valorCentavos??0, taxas=(entradas._sum.taxaCentavos??0)-(estornos._sum.taxaCentavos??0)
      const despesasBrutas=despesas._sum.valorCentavos??0, estornoDespesas=despesasEstornadas._sum.valorCentavos??0, repasses=comissoes._sum.valorCentavos??0
      const saldo=bruto-estornado-taxas-despesasBrutas+estornoDespesas-repasses
      const aberto=cobrancas.reduce((s,c)=>s+cobrancaComSaldo(c).saldoCentavos,0)
      return {inicio:r.data.inicio,fim:r.data.fim,recebimentosCentavos:bruto,estornosCentavos:estornado,taxasCentavos:taxas,despesasCentavos:despesasBrutas,estornosDespesasCentavos:estornoDespesas,repassesCentavos:repasses,saldoCentavos:saldo,aReceberCentavos:aberto}
    })
    return {dados}
  })
  app.get('/api/v1/configuracao',{preHandler:equipe},async()=>({dados:await prisma.configuracaoClinica.findUnique({where:{id:'clinica'}})}))
  app.patch('/api/v1/configuracao',{preHandler:admin},async(req:RequisicaoAutenticada,res)=>{
    const r=v.configuracao.safeParse(req.body);if(!r.success)return res.code(400).send({erro:'Configuração inválida'})
    const dados=await transacao(async t=>{const c=await t.configuracaoClinica.upsert({where:{id:'clinica'},create:{id:'clinica',...r.data},update:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','configuracao_clinica',c.id);return c})
    return {dados}
  })
}
