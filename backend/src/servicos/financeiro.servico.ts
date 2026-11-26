import { travarFinanceiro } from '../repositorios/transacao.repositorio.js'
import { travarAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioCobranca } from '../repositorios/cobranca.repositorio.js'
import { repositorioComissao } from '../repositorios/comissao.repositorio.js'
import { repositorioConfiguracaoClinica } from '../repositorios/configuracao-clinica.repositorio.js'
import { repositorioConsumoSessao } from '../repositorios/consumo-sessao.repositorio.js'
import { repositorioContratoPlano } from '../repositorios/contrato-plano.repositorio.js'
import { repositorioDespesa } from '../repositorios/despesa.repositorio.js'
import { repositorioPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioParceria } from '../repositorios/parceria.repositorio.js'
import { repositorioPlanoTratamento } from '../repositorios/plano-tratamento.repositorio.js'
import { repositorioProfissional } from '../repositorios/profissional.repositorio.js'
import { repositorioRecebimento } from '../repositorios/recebimento.repositorio.js'
import { repositorioRegistroAuditoria } from '../repositorios/registro-auditoria.repositorio.js'
import { repositorioServico } from '../repositorios/servico.repositorio.js'
import { repositorioTaxaPagamento } from '../repositorios/taxa-pagamento.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { dataLocal } from '../validacoes/agenda.validacao.js'
import * as v from '../validacoes/financeiro.validacao.js'

class ErroFinanceiro extends Error { constructor(public status: number, mensagem: string) { super(mensagem) } }

const falhar = (status:number,mensagem:string):never => {throw new ErroFinanceiro(status,mensagem)}

function tratar(e:unknown) {
  if(e instanceof ErroFinanceiro)return retornarResultado(e.status, {erro:e.message})
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
  await repositorioRegistroAuditoria(t).criar({data:{usuarioId:u,acao,entidade,entidadeId:id}})
}

// Serialização financeira simples e independente da agenda; operações curtas.
async function transacao<T>(fn:(t:Prisma.TransactionClient)=>Promise<T>) {
  return emTransacao(async t=>{
    await travarFinanceiro(t)
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
  const c=await repositorioCobranca(t).buscarUnicoOuFalhar({where:{id}})
  const pago=(await repositorioRecebimento(t).agregar({where:{cobrancaId:id,estornadoEm:null},_sum:{valorCentavos:true}}))._sum.valorCentavos??0
  const situacao=situacaoCobranca(c,pago) as import('@prisma/client').SituacaoCobranca
  await repositorioCobranca(t).atualizar({where:{id},data:{situacao}})
}

function cobrancaComSaldo<T extends {valorCentavos:number;vencimentoEm:Date;situacao:string;recebimentos:{valorCentavos:number;estornadoEm:Date|null}[]}>(c:T) {
  const pago=c.recebimentos.filter(r=>!r.estornadoEm).reduce((s,r)=>s+r.valorCentavos,0)
  return {...c,situacao:situacaoCobranca(c,pago),valorRecebidoCentavos:pago,saldoCentavos:c.situacao==='CANCELADA'?0:c.valorCentavos-pago}
}

export async function listarParcerias() { return ({dados:await repositorioParceria().listar({orderBy:{nome:'asc'},take:500})}) }

export async function criarParceria(req: EntradaOperacao) {
    const r=v.parceria.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Parceria inválida'})
    const dados=await transacao(async t=>{const c=await repositorioParceria(t).criar({data:r.data});await auditar(t,req.identidade!.id,'CRIAR','parceria',c.id);return c})
    return retornarResultado(201, {dados})
}

export async function atualizarParceria(req: EntradaOperacao) {
    const r=v.edicaoParceria.safeParse(req.corpo);if(!r.success||!Object.keys(r.data).length)return retornarResultado(400, {erro:'Alteração inválida'})
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{if(!await repositorioParceria(t).buscarUnico({where:{id}}))falhar(404,'Parceria não encontrada');const c=await repositorioParceria(t).atualizar({where:{id},data:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','parceria',id);return c})}}catch(e){return tratar(e)}
}

export async function listarTaxas() { return ({dados:await repositorioTaxaPagamento().listar({orderBy:{criadaEm:'desc'},take:500})}) }

export async function criarTaxa(req: EntradaOperacao) {
    const r=v.taxa.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Taxa inválida'})
    const dados=await transacao(async t=>{const c=await repositorioTaxaPagamento(t).criar({data:r.data});await auditar(t,req.identidade!.id,'CRIAR_VERSAO','taxa_pagamento',c.id);return c})
    return retornarResultado(201, {dados})
}

export async function listarPlanos() { return ({dados:await repositorioPlanoTratamento().listar({orderBy:{nome:'asc'},take:500})}) }

export async function criarPlano(req: EntradaOperacao) {
    const r=v.plano.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Plano inválido'})
    try{const dados=await transacao(async t=>{if(!(await repositorioServico(t).buscarUnico({where:{id:r.data.servicoId}}))?.ativo)falhar(400,'Serviço indisponível');const c=await repositorioPlanoTratamento(t).criar({data:r.data});await auditar(t,req.identidade!.id,'CRIAR','plano_tratamento',c.id);return c});return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function atualizarPlano(req: EntradaOperacao) {
    const r=v.edicaoPlano.safeParse(req.corpo);if(!r.success||!Object.keys(r.data).length)return retornarResultado(400, {erro:'Alteração inválida'})
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{if(!await repositorioPlanoTratamento(t).buscarUnico({where:{id}}))falhar(404,'Plano não encontrado');if(r.data.servicoId&&!(await repositorioServico(t).buscarUnico({where:{id:r.data.servicoId}}))?.ativo)falhar(400,'Serviço indisponível');const c=await repositorioPlanoTratamento(t).atualizar({where:{id},data:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','plano_tratamento',id);return c})}}catch(e){return tratar(e)}
}

export async function listarContratos(req: EntradaOperacao) {
    const r=v.consultaContratos.safeParse(req.consulta);if(!r.success)return retornarResultado(400, {erro:'Consulta inválida'})
    const where={...(r.data.pacienteId?{pacienteId:r.data.pacienteId}:{})}
    const [total,items]=await emTransacao([repositorioContratoPlano().contar({where}),repositorioContratoPlano().listar({where,include:incluirContrato,orderBy:{criadoEm:'desc'},skip:(r.data.pagina-1)*50,take:50})])
    return {dados:items.map(contratoComSaldo),total}
}

export async function criarContrato(req: EntradaOperacao) {
    const r=v.contrato.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Contrato inválido'})
    try{const dados=await transacao(async t=>{
      const d=r.data
      const [plano,paciente,parceria,anterior]=await Promise.all([
        repositorioPlanoTratamento(t).buscarUnico({where:{id:d.planoId},include:{servico:true}}),repositorioPaciente(t).buscarUnico({where:{id:d.pacienteId}}),
        d.parceriaId?repositorioParceria(t).buscarUnico({where:{id:d.parceriaId}}):null,d.renovacaoDeId?repositorioContratoPlano(t).buscarUnico({where:{id:d.renovacaoDeId}}):null])
      if(!plano?.ativo||!plano.servico.ativo||!paciente?.ativo||(d.parceriaId&&!parceria?.ativo))return falhar(400,'Plano, paciente ou parceria indisponível')
      const inicio=data(d.inicioEm), fim=somarDias(inicio,plano.validadeDias-1)
      if(d.renovacaoDeId&&(!anterior||anterior.pacienteId!==d.pacienteId||anterior.servicoId!==plano.servicoId||inicio<=anterior.fimEm))return falhar(400,'Renovação deve ser do mesmo paciente e serviço após o término')
      if(data(d.primeiroVencimento)<inicio)return falhar(400,'Primeiro vencimento anterior ao início')
      const desconto=parceria?.descontoPontosBase??0, valor=plano.valorCentavos-arredondar(plano.valorCentavos,desconto)
      if(valor<d.quantidadeParcelas)return falhar(400,'Valor insuficiente para a quantidade de parcelas')
      const base=Math.floor(valor/d.quantidadeParcelas),resto=valor%d.quantidadeParcelas
      const c=await repositorioContratoPlano(t).criar({data:{chaveOperacao:d.chaveOperacao,pacienteId:d.pacienteId,planoId:d.planoId,parceriaId:d.parceriaId,renovacaoDeId:d.renovacaoDeId,nomePlano:plano.nome,servicoId:plano.servicoId,modalidade:plano.modalidade,sessoesContratadas:plano.sessoes,valorOriginalCentavos:plano.valorCentavos,descontoPontosBase:desconto,valorFinalCentavos:valor,quantidadeParcelas:d.quantidadeParcelas,inicioEm:inicio,fimEm:fim,cobrancas:{create:Array.from({length:d.quantidadeParcelas},(_,i)=>({pacienteId:d.pacienteId,descricao:plano.nome+' - parcela '+(i+1)+'/'+d.quantidadeParcelas,parcela:i+1,valorCentavos:base+(i<resto?1:0),vencimentoEm:mes(data(d.primeiroVencimento),i)}))}},include:incluirContrato})
      await auditar(t,req.identidade!.id,d.renovacaoDeId?'RENOVAR':'CONTRATAR','contrato_plano',c.id)
      return contratoComSaldo(c)
    });return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function registrarConsumo(req: EntradaOperacao) {
    const r=v.consumo.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Consumo inválido'})
    try{const dados=await transacao(async t=>{
      await travarAgendamento(t, r.data.agendamentoId)
      const a=await repositorioAgendamento(t).buscarUnico({where:{id:r.data.agendamentoId}}),c=await repositorioContratoPlano(t).buscarUnico({where:{id:r.data.contratoId},include:{_count:{select:{consumos:true}}}})
      if(!a||!c||a.situacao!=='CONCLUIDO'||a.pacienteId!==c.pacienteId||a.servicoId!==c.servicoId)return falhar(400,'Atendimento concluído do mesmo paciente e serviço é obrigatório')
      const dia=data(dataLocal(a.inicioEm).data)
      if(dia<c.inicioEm||dia>c.fimEm||c._count.consumos>=c.sessoesContratadas)return falhar(409,'Contrato fora da validade ou sem sessões')
      const item=await repositorioConsumoSessao(t).criar({data:r.data})
      await auditar(t,req.identidade!.id,'CONSUMIR','consumo_sessao',item.id);return item
    });return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function listarCobrancas(req: EntradaOperacao) {
    const r=v.consultaCobrancas.safeParse(req.consulta);if(!r.success)return retornarResultado(400, {erro:'Consulta inválida'})
    const where={...(r.data.pacienteId?{pacienteId:r.data.pacienteId}:{})}
    const [total,items]=await emTransacao([repositorioCobranca().contar({where}),repositorioCobranca().listar({where,include:incluirCobranca,orderBy:[{vencimentoEm:'desc'},{id:'desc'}],skip:(r.data.pagina-1)*50,take:50})])
    return {dados:items.map(cobrancaComSaldo),total}
}

export async function criarCobranca(req: EntradaOperacao) {
    const r=v.cobranca.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Cobrança inválida'})
    try{const dados=await transacao(async t=>{if(!(await repositorioPaciente(t).buscarUnico({where:{id:r.data.pacienteId}}))?.ativo)falhar(400,'Paciente indisponível');const c=await repositorioCobranca(t).criar({data:{...r.data,vencimentoEm:data(r.data.vencimentoEm)},include:incluirCobranca});await auditar(t,req.identidade!.id,'CRIAR','cobranca',c.id);return cobrancaComSaldo(c)});return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function cancelarCobranca(req: EntradaOperacao) {
    const r=v.motivo.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Informe motivo'})
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{
      const c=await repositorioCobranca(t).buscarUnico({where:{id},include:incluirCobranca});if(!c)return falhar(404,'Cobrança inexistente')
      if(c.situacao==='CANCELADA'||c.recebimentos.some(x=>!x.estornadoEm))return falhar(409,'Estorne os recebimentos antes de cancelar')
      const item=await repositorioCobranca(t).atualizar({where:{id},data:{situacao:'CANCELADA',motivoCancelamento:r.data.motivo},include:incluirCobranca})
      await auditar(t,req.identidade!.id,'CANCELAR','cobranca',id);return cobrancaComSaldo(item)
    })}}catch(e){return tratar(e)}
}

export async function registrarRecebimento(req: EntradaOperacao) {
    const r=v.recebimento.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Recebimento inválido'})
    const {id}=req.parametros as {id:string}
    try{const dados=await transacao(async t=>{
      const c=await repositorioCobranca(t).buscarUnico({where:{id},include:incluirCobranca})
      if(!c)return falhar(404,'Cobrança inexistente')
      if(c.situacao==='CANCELADA'||c.situacao==='ESTORNADA'||r.data.valorCentavos>cobrancaComSaldo(c).saldoCentavos)return falhar(409,'Cobrança encerrada ou valor maior que saldo')
      const taxa=r.data.taxaId?await repositorioTaxaPagamento(t).buscarUnico({where:{id:r.data.taxaId}}):null
      if(r.data.taxaId&&(!taxa||taxa.formaPagamento!==r.data.formaPagamento||taxa.parcelas!==r.data.parcelas))return falhar(400,'Taxa incompatível')
      const pontos=taxa?.pontosBase??0
      const item=await repositorioRecebimento(t).criar({data:{...r.data,cobrancaId:id,taxaPontosBase:pontos,taxaCentavos:arredondar(r.data.valorCentavos,pontos)}})
      await recalcular(t,id);await auditar(t,req.identidade!.id,'RECEBER','recebimento',item.id);return item
    });return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function estornarRecebimento(req: EntradaOperacao) {
    const r=v.motivo.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Informe motivo'})
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{
      const atual=await repositorioRecebimento(t).buscarUnico({where:{id},include:{comissao:true}})
      if(!atual)return falhar(404,'Recebimento inexistente')
      if(atual.estornadoEm||atual.comissao?.pagaEm)return falhar(409,'Recebimento estornado ou comissão já paga')
      const instante=new Date()
      if(atual.comissao&&!atual.comissao.canceladaEm){await repositorioComissao(t).atualizar({where:{id:atual.comissao.id},data:{canceladaEm:instante}});await auditar(t,req.identidade!.id,'CANCELAR','comissao',atual.comissao.id)}
      const item=await repositorioRecebimento(t).atualizar({where:{id},data:{estornadoEm:instante,motivoEstorno:r.data.motivo}})
      await recalcular(t,item.cobrancaId);await auditar(t,req.identidade!.id,'ESTORNAR','recebimento',id);return item
    })}}catch(e){return tratar(e)}
}

export async function listarDespesas(req: EntradaOperacao) {
    const r=v.consultaPeriodo.safeParse(req.consulta);if(!r.success)return retornarResultado(400, {erro:'Período inválido'})
    return {dados:await repositorioDespesa().listar({where:{ocorridaEm:{gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}},orderBy:{ocorridaEm:'desc'},take:500})}
}

export async function criarDespesa(req: EntradaOperacao) {
    const r=v.despesa.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Despesa inválida'})
    const dados=await transacao(async t=>{const c=await repositorioDespesa(t).criar({data:{...r.data,ocorridaEm:data(r.data.ocorridaEm)}});await auditar(t,req.identidade!.id,'CRIAR','despesa',c.id);return c})
    return retornarResultado(201, {dados})
}

export async function estornarDespesa(req: EntradaOperacao) {
    const r=v.motivo.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Informe motivo'})
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{const atual=await repositorioDespesa(t).buscarUnico({where:{id}});if(!atual)return falhar(404,'Despesa inexistente');if(atual.estornadaEm)return falhar(409,'Despesa já estornada');const c=await repositorioDespesa(t).atualizar({where:{id},data:{estornadaEm:new Date(),motivoEstorno:r.data.motivo}});await auditar(t,req.identidade!.id,'ESTORNAR','despesa',id);return c})}}catch(e){return tratar(e)}
}

export async function listarComissoes(req: EntradaOperacao) {
    const r=v.consultaPeriodo.safeParse(req.consulta);if(!r.success)return retornarResultado(400, {erro:'Período inválido'})
    return {dados:await repositorioComissao().listar({where:{criadaEm:{gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}},orderBy:{criadaEm:'desc'},take:500})}
}

export async function registrarComissao(req: EntradaOperacao) {
    const r=v.comissao.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Comissão inválida'})
    try{const dados=await transacao(async t=>{
      const [recebido,profissional]=await Promise.all([repositorioRecebimento(t).buscarUnico({where:{id:r.data.recebimentoId}}),repositorioProfissional(t).buscarUnico({where:{id:r.data.profissionalId}})])
      if(!recebido||recebido.estornadoEm||!profissional?.ativo)return falhar(400,'Recebimento ou profissional indisponível')
      const baseCentavos=recebido.valorCentavos-recebido.taxaCentavos
      const valorCentavos=arredondar(baseCentavos,r.data.pontosBase)
      if(!valorCentavos)return falhar(400,'Comissão menor que um centavo')
      const item=await repositorioComissao(t).criar({data:{...r.data,baseCentavos,valorCentavos}})
      await auditar(t,req.identidade!.id,'CRIAR','comissao',item.id);return item
    });return retornarResultado(201, {dados})}catch(e){return tratar(e)}
}

export async function pagarComissao(req: EntradaOperacao) {
    const {id}=req.parametros as {id:string}
    try{return {dados:await transacao(async t=>{const c=await repositorioComissao(t).buscarUnico({where:{id}});if(!c)return falhar(404,'Comissão inexistente');if(c.pagaEm||c.canceladaEm)return falhar(409,'Comissão já paga ou cancelada');const item=await repositorioComissao(t).atualizar({where:{id},data:{pagaEm:new Date()}});await auditar(t,req.identidade!.id,'PAGAR','comissao',id);return item})}}catch(e){return tratar(e)}
}

export async function consultarRelatorio(req: EntradaOperacao) {
    const r=v.consultaPeriodo.safeParse(req.consulta);if(!r.success)return retornarResultado(400, {erro:'Período inválido'})
    // Recebimentos/estornos em fuso de São Paulo; despesas registradas por data civil.
    const civil={gte:data(r.data.inicio),lt:somarDias(data(r.data.fim),1)}
    const real={gte:new Date(r.data.inicio+'T00:00:00-03:00'),lt:new Date(somarDias(data(r.data.fim),1).toISOString().slice(0,10)+'T00:00:00-03:00')}
    const dados=await transacao(async t=>{
      const [entradas,estornos,despesas,despesasEstornadas,comissoes,cobrancas]=await Promise.all([
        repositorioRecebimento(t).agregar({where:{recebidoEm:real},_sum:{valorCentavos:true,taxaCentavos:true}}),
        repositorioRecebimento(t).agregar({where:{estornadoEm:real},_sum:{valorCentavos:true,taxaCentavos:true}}),
        repositorioDespesa(t).agregar({where:{ocorridaEm:civil},_sum:{valorCentavos:true}}),
        repositorioDespesa(t).agregar({where:{estornadaEm:real},_sum:{valorCentavos:true}}),
        repositorioComissao(t).agregar({where:{pagaEm:real},_sum:{valorCentavos:true}}),
        repositorioCobranca(t).listar({where:{vencimentoEm:civil,situacao:{notIn:['CANCELADA','ESTORNADA']}},select:{valorCentavos:true,vencimentoEm:true,situacao:true,recebimentos:{where:{estornadoEm:null},select:{valorCentavos:true,estornadoEm:true}}}})
      ])
      const bruto=entradas._sum.valorCentavos??0, estornado=estornos._sum.valorCentavos??0, taxas=(entradas._sum.taxaCentavos??0)-(estornos._sum.taxaCentavos??0)
      const despesasBrutas=despesas._sum.valorCentavos??0, estornoDespesas=despesasEstornadas._sum.valorCentavos??0, repasses=comissoes._sum.valorCentavos??0
      const saldo=bruto-estornado-taxas-despesasBrutas+estornoDespesas-repasses
      const aberto=cobrancas.reduce((s,c)=>s+cobrancaComSaldo(c).saldoCentavos,0)
      return {inicio:r.data.inicio,fim:r.data.fim,recebimentosCentavos:bruto,estornosCentavos:estornado,taxasCentavos:taxas,despesasCentavos:despesasBrutas,estornosDespesasCentavos:estornoDespesas,repassesCentavos:repasses,saldoCentavos:saldo,aReceberCentavos:aberto}
    })
    return {dados}
}

export async function consultarConfiguracao() { return ({dados:await repositorioConfiguracaoClinica().buscarUnico({where:{id:'clinica'}})}) }

export async function salvarConfiguracao(req: EntradaOperacao) {
    const r=v.configuracao.safeParse(req.corpo);if(!r.success)return retornarResultado(400, {erro:'Configuração inválida'})
    const dados=await transacao(async t=>{const c=await repositorioConfiguracaoClinica(t).criarOuAtualizar({where:{id:'clinica'},create:{id:'clinica',...r.data},update:r.data});await auditar(t,req.identidade!.id,'ATUALIZAR','configuracao_clinica',c.id);return c})
    return {dados}
}
