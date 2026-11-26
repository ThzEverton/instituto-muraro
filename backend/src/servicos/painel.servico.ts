import { repositorioAgendamento } from '../repositorios/agendamento.repositorio.js'
import { repositorioCobranca } from '../repositorios/cobranca.repositorio.js'
import { repositorioContratoPlano } from '../repositorios/contrato-plano.repositorio.js'
import { repositorioPaciente } from '../repositorios/paciente.repositorio.js'
import { repositorioRecebimento } from '../repositorios/recebimento.repositorio.js'
import { emTransacao } from '../repositorios/transacao.repositorio.js'
import { resultado as retornarResultado, type EntradaOperacao } from '../tipos/operacao.js'
import { dataLocal, inicioDiaLocal, diaSeguinte } from '../validacoes/agenda.validacao.js'



export async function consultarResumo(req: EntradaOperacao) {
  const hoje=dataLocal(new Date()).data, inicio=inicioDiaLocal(hoje), fim=inicioDiaLocal(diaSeguinte(hoje))
  const [pacientesAtivos,atendimentosHoje,sessoesConcluidas,agenda]=await emTransacao([
   repositorioPaciente().contar({where:{ativo:true}}),
   repositorioAgendamento().contar({where:{inicioEm:{gte:inicio,lt:fim},situacao:{not:'CANCELADO'}}}),
   repositorioAgendamento().contar({where:{inicioEm:{gte:inicio,lt:fim},situacao:'CONCLUIDO'}}),
   repositorioAgendamento().listar({where:{inicioEm:{gte:inicio,lt:fim},situacao:{not:'CANCELADO'}},select:{id:true,inicioEm:true,situacao:true,paciente:{select:{nomeCompleto:true}},profissional:{select:{nome:true}},servico:{select:{nome:true}}},orderBy:{inicioEm:'asc'},take:20})
  ])
  let financeiro=null
  if(req.identidade!.perfil==='ADMINISTRADOR'){
   const inicioMes=inicioDiaLocal(hoje.slice(0,7)+'-01'),dataCivil=new Date(hoje)
   const [recebimentos,estornos,planosAtivos,cobrancas]=await emTransacao([
    repositorioRecebimento().agregar({where:{recebidoEm:{gte:inicioMes,lt:fim}},_sum:{valorCentavos:true}}),
    repositorioRecebimento().agregar({where:{estornadoEm:{gte:inicioMes,lt:fim}},_sum:{valorCentavos:true}}),
    repositorioContratoPlano().contar({where:{inicioEm:{lte:dataCivil},fimEm:{gte:dataCivil}}}),
    repositorioCobranca().contar({where:{vencimentoEm:{lt:dataCivil},situacao:{in:['PENDENTE','PARCIAL','VENCIDA']}}})
   ])
   financeiro={recebidoMesCentavos:(recebimentos._sum.valorCentavos??0)-(estornos._sum.valorCentavos??0),planosAtivos,cobrancasVencidas:cobrancas}
  }
  return {dados:{data:hoje,pacientesAtivos,atendimentosHoje,sessoesConcluidas,agenda,financeiro}}
 }
