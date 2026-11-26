import type { FastifyInstance } from 'fastify'
import { prisma } from '../../infraestrutura/banco-de-dados/prisma.js'
import { exigirPerfis, type RequisicaoAutenticada } from '../autenticacao/autenticacao.rotas.js'
import { dataLocal, inicioDiaLocal, diaSeguinte } from '../agenda/agenda.validacao.js'
export async function registrarRotasPainel(app:FastifyInstance){
 app.get('/api/v1/painel/resumo',{preHandler:exigirPerfis(['ADMINISTRADOR','RECEPCAO'])},async(req:RequisicaoAutenticada)=>{
  const hoje=dataLocal(new Date()).data, inicio=inicioDiaLocal(hoje), fim=inicioDiaLocal(diaSeguinte(hoje))
  const [pacientesAtivos,atendimentosHoje,sessoesConcluidas,agenda]=await prisma.$transaction([
   prisma.paciente.count({where:{ativo:true}}),
   prisma.agendamento.count({where:{inicioEm:{gte:inicio,lt:fim},situacao:{not:'CANCELADO'}}}),
   prisma.agendamento.count({where:{inicioEm:{gte:inicio,lt:fim},situacao:'CONCLUIDO'}}),
   prisma.agendamento.findMany({where:{inicioEm:{gte:inicio,lt:fim},situacao:{not:'CANCELADO'}},select:{id:true,inicioEm:true,situacao:true,paciente:{select:{nomeCompleto:true}},profissional:{select:{nome:true}},servico:{select:{nome:true}}},orderBy:{inicioEm:'asc'},take:20})
  ])
  let financeiro=null
  if(req.identidade!.perfil==='ADMINISTRADOR'){
   const inicioMes=inicioDiaLocal(hoje.slice(0,7)+'-01'),dataCivil=new Date(hoje)
   const [recebimentos,estornos,planosAtivos,cobrancas]=await prisma.$transaction([
    prisma.recebimento.aggregate({where:{recebidoEm:{gte:inicioMes,lt:fim}},_sum:{valorCentavos:true}}),
    prisma.recebimento.aggregate({where:{estornadoEm:{gte:inicioMes,lt:fim}},_sum:{valorCentavos:true}}),
    prisma.contratoPlano.count({where:{inicioEm:{lte:dataCivil},fimEm:{gte:dataCivil}}}),
    prisma.cobranca.count({where:{vencimentoEm:{lt:dataCivil},situacao:{in:['PENDENTE','PARCIAL','VENCIDA']}}})
   ])
   financeiro={recebidoMesCentavos:(recebimentos._sum.valorCentavos??0)-(estornos._sum.valorCentavos??0),planosAtivos,cobrancasVencidas:cobrancas}
  }
  return {dados:{data:hoje,pacientesAtivos,atendimentosHoje,sessoesConcluidas,agenda,financeiro}}
 })
}
