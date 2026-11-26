import { z } from 'zod'
import { entradaAutenticacao } from '../../modulos/autenticacao/autenticacao.validacao.js'
import { cadastroPaciente, edicaoPaciente, consultaPacientes } from '../../modulos/pacientes/pacientes.validacao.js'
import { cadastroProfissional, edicaoProfissional } from '../../modulos/profissionais/profissionais.validacao.js'
import { cadastroServico, edicaoServico } from '../../modulos/servicos/servicos.validacao.js'
import { consultaCadastros } from '../../compartilhado/validacoes/consulta-cadastros.js'
import { consultaAgenda, consultaDisponibilidade, edicaoAgendamento, entradaAgendamento, entradaBloqueio, entradaSala, entradaSerie, entradaAusencia } from '../../modulos/agenda/agenda.validacao.js'
import * as clinica from '../../modulos/prontuario/prontuario.validacao.js'
import * as formulario from '../../modulos/formularios/formularios.validacao.js'

const id = z.string().min(1)
const texto = z.string()
const inteiro = z.number().int()
const booleano = z.boolean()
const instante = z.iso.datetime({ offset: true })
const perfil = z.enum(['ADMINISTRADOR','RECEPCAO','FISIOTERAPEUTA'])
const situacaoAgenda = z.enum(['AGENDADO','AGUARDANDO_CONFIRMACAO','CONFIRMADO','EM_ATENDIMENTO','CONCLUIDO','CANCELADO','NAO_COMPARECEU'])
const situacaoClinica = z.enum(['RASCUNHO','FINALIZADO'])
const tipoClinico = z.enum(['ANAMNESE','AVALIACAO','EVOLUCAO','ADENDO'])
const dados = (schema: z.ZodType) => z.object({ dados: schema })
const lista = (schema: z.ZodType) => dados(z.array(schema))
const paginado = (schema: z.ZodType) => z.object({ dados: z.array(schema), paginacao: z.object({ pagina: inteiro, totalRegistros: inteiro, totalPaginas: inteiro }) })
const usuario = z.object({ id, nome: texto, email: z.email() })
const pacienteMinimo = z.object({ id, nomeCompleto: texto, ativo: booleano })
const paciente = pacienteMinimo.extend({
  cpf: texto.nullable(), dataNascimento: instante.nullable(), telefone: texto.nullable(), whatsapp: texto.nullable(), email: texto.nullable(), endereco: texto.nullable(),
  responsavelLegal: texto.nullable(), contatoEmergencia: texto.nullable(), observacoesAdministrativas: texto.nullable(), formaAtendimento: texto.nullable(),
  criadoEm: instante, atualizadoEm: instante,
})
const profissional = z.object({
  id, nome: texto, especialidade: texto, crefito: texto.nullable(), telefone: texto.nullable(), email: texto.nullable(), corAgenda: texto.nullable(),
  ativo: booleano, usuarioId: id.nullable(), servicos: z.array(z.object({ servicoId: id })),
  expedientes: z.array(z.object({ id, diaSemana: inteiro, inicioMinuto: inteiro, fimMinuto: inteiro })),
})
const servico = z.object({ id, nome: texto, categoria: texto.nullable(), descricao: texto.nullable(), duracaoMinutos: inteiro, valorCentavos: inteiro, capacidade: inteiro, ativo: booleano, profissionais: z.array(z.object({ profissionalId: id })) })
const agendamento = z.object({ id, pacienteId: id, profissionalId: id, servicoId: id, salaId: id.nullable(), serieId: id.nullable(), inicioEm: instante, fimEm: instante, situacao: situacaoAgenda })
const sala = z.object({ id, nome: texto, capacidade: inteiro, ativo: booleano })
const bloqueio = z.object({ id, profissionalId: id, inicioEm: instante, fimEm: instante, tipo: texto, recorrente: booleano, ativo: booleano, criadoEm: instante })
const ausencia = z.object({ id, profissionalId: id.nullable(), dataInicio: z.iso.date(), dataFim: z.iso.date(), motivo: texto, ativo: booleano, criadoEm: instante })
const vinculo = z.object({ id, pacienteId: id, profissionalId: id, ativo: booleano, criadoEm: instante })
const entradaClinica = z.object({ id, autorId: id, autorNome: texto.nullable(), autorRegistro: texto.nullable(), tipo: tipoClinico, texto, situacao: situacaoClinica, versao: inteiro, criadaEm: instante, finalizadaEm: instante.nullable() })
const modeloPublico = z.object({ titulo: texto, versao: inteiro, perguntas: formulario.perguntas })
const modelo = modeloPublico.extend({ id, situacao: z.enum(['RASCUNHO','PUBLICADO']), revisao: inteiro, servicoId: id.nullable(), modeloAnteriorId: id.nullable(), publicadoEm: instante.nullable() })
const respostaMetadados = z.object({ id, enviadaEm: instante })
const respostaClinica = respostaMetadados.extend({ respostas: z.record(z.string(),z.union([texto,z.number(),booleano,z.null()])), link: z.object({ agendamentoId: id, modelo: modeloPublico }) })
const link = z.object({ id, modeloId: id, agendamentoId: id, criadoEm: instante, expiraEm: instante, revogadoEm: instante.nullable(), modelo: modeloPublico.pick({ titulo: true, versao: true }), respostas: z.array(respostaMetadados) })
const token = z.string().regex(/^[a-f0-9]{64}$/)
const erro = z.object({ erro: texto })

export const etiquetas = [
  { name: 'Saúde da API', description: 'Disponibilidade do backend e do PostgreSQL.' },
  { name: 'Autenticação', description: 'Sessões e credenciais.' },
  { name: 'Pacientes', description: 'Cadastros administrativos.' },
  { name: 'Profissionais', description: 'Profissionais, serviços e expedientes.' },
  { name: 'Serviços', description: 'Procedimentos e capacidade.' },
  { name: 'Agenda', description: 'Atendimentos, salas, disponibilidade e bloqueios.' },
  { name: 'Acessos clínicos', description: 'Contas e vínculos clínicos sem acesso ao conteúdo.' },
  { name: 'Prontuário', description: 'Registros clínicos e respostas de pacientes autorizados.' },
  { name: 'Formulários', description: 'Modelos, versões e emissão de links.' },
  { name: 'Pré-consulta pública', description: 'Consulta e envio por token individual, sem sessão de usuário.' },
]
type Perfil = 'ADMINISTRADOR' | 'RECEPCAO' | 'FISIOTERAPEUTA'
const admin: Perfil[] = ['ADMINISTRADOR']
const equipe: Perfil[] = ['ADMINISTRADOR','RECEPCAO']
const todos: Perfil[] = ['ADMINISTRADOR','RECEPCAO','FISIOTERAPEUTA']
const fisio: Perfil[] = ['FISIOTERAPEUTA']
const publico: Perfil[] = []
type Entrada = { corpo?: z.ZodType; consulta?: z.ZodType; exemplo?: object }
type Definicao = { metodo: string; rota: string; etiqueta: string; resumo: string; descricao: string; perfis: Perfil[]; saida: z.ZodType; sucesso: number; erros: number[]; entrada?: Entrada }
const definicoes: Definicao[] = []
function registrar(metodo: string, rota: string, etiqueta: string, resumo: string, descricao: string, perfis: Perfil[], saida: z.ZodType, entrada?: Entrada, erros: number[] = [], sucesso = metodo === 'POST' ? 201 : 200) {
  definicoes.push({ metodo, rota: '/api/v1/' + rota, etiqueta, resumo, descricao, perfis, saida, entrada, erros, sucesso })
}
const corpo = (schema: z.ZodType, exemplo: object): Entrada => ({ corpo: schema, exemplo })
const consulta = (schema: z.ZodType): Entrada => ({ consulta: schema })
const idPaciente = 'paciente_exemplo'
const idProfissional = 'profissional_exemplo'
const idServico = 'servico_exemplo'
const idModelo = 'modelo_exemplo'
const idAtendimento = 'agendamento_exemplo'
const periodo = { inicioEm: '2027-01-04T08:00:00-03:00', fimEm: '2027-01-04T09:00:00-03:00' }
const exemploAgendamento = { pacienteId: idPaciente, profissionalId: idProfissional, servicoId: idServico, ...periodo }
const exemploModelo = { titulo: 'Formulário de exemplo', servicoId: idServico, perguntas: [{ id: 'pergunta1', rotulo: 'Pergunta fictícia', tipo: 'TEXTO', obrigatoria: true }] }
const exemploToken = '0'.repeat(64)

registrar('GET','saude','Saúde da API','Verificar disponibilidade','Confere a conexão com o banco de dados.',publico,z.object({ situacao: z.literal('operacional') }),undefined,[503])
registrar('POST','autenticacao/entrar','Autenticação','Iniciar sessão','Valida e-mail e senha e retorna token Bearer válido por oito horas. Limite de cinco tentativas por minuto.',publico,dados(z.object({ usuario: usuario.omit({email:true}).extend({perfil}), token, expiraEm: instante })),corpo(entradaAutenticacao,{email:'usuario@example.test',senha:'SENHA_FICTICIA'}),[400,401],200)
registrar('GET','autenticacao/sessao','Autenticação','Consultar sessão','Identifica o usuário autenticado e seu perfil.',todos,dados(z.object({id,perfil})))
registrar('POST','autenticacao/sair','Autenticação','Encerrar sessão','Revoga o token utilizado na requisição. Não exige corpo.',todos,dados(z.object({sessaoEncerrada:z.literal(true)})),undefined,[],200)

registrar('GET','pacientes','Pacientes','Listar pacientes','Pesquisa por nome, situação e paginação.',equipe,paginado(paciente),consulta(consultaPacientes),[400])
registrar('POST','pacientes','Pacientes','Cadastrar paciente','Valida o CPF quando informado e registra auditoria.',equipe,dados(paciente),corpo(cadastroPaciente,{nomeCompleto:'Paciente de exemplo',telefone:'11900000000'}),[400,409])
registrar('GET','pacientes/:id','Pacientes','Consultar paciente','Retorna o cadastro administrativo pelo identificador.',equipe,dados(paciente),undefined,[404])
registrar('PATCH','pacientes/:id','Pacientes','Atualizar paciente','Altera dados administrativos ou inativa sem apagar o histórico. Exige pelo menos um campo.',equipe,dados(paciente),corpo(edicaoPaciente,{ativo:false}),[400,404,409])

registrar('GET','profissionais','Profissionais','Listar profissionais','Pesquisa paginada com serviços e expedientes vinculados.',equipe,paginado(profissional),consulta(consultaCadastros),[400])
registrar('POST','profissionais','Profissionais','Cadastrar profissional','Valida serviços ativos, duplicidade e sobreposição de expedientes. Dia da semana: 0 domingo, 6 sábado; horários em minutos desde meia-noite.',equipe,dados(profissional),corpo(cadastroProfissional,{nome:'Profissional de exemplo',especialidade:'Fisioterapia',servicosIds:[idServico],expedientes:[{diaSemana:1,inicioMinuto:480,fimMinuto:720}]}),[400,409])
registrar('GET','profissionais/:id','Profissionais','Consultar profissional','Retorna dados, serviços e expedientes.',equipe,dados(profissional),undefined,[404])
registrar('PATCH','profissionais/:id','Profissionais','Atualizar profissional','Altera cadastro e substitui listas de serviços ou expedientes quando enviadas. Exige ao menos um campo.',equipe,dados(profissional),corpo(edicaoProfissional,{nome:'Profissional atualizado'}),[400,404,409])

registrar('GET','servicos','Serviços','Listar serviços','Pesquisa paginada dos serviços e profissionais vinculados.',todos,paginado(servico),consulta(consultaCadastros),[400])
registrar('POST','servicos','Serviços','Cadastrar serviço','Define duração, valor em centavos, capacidade e profissionais.',equipe,dados(servico),corpo(cadastroServico,{nome:'Procedimento fictício',duracaoMinutos:60,valorCentavos:10000,capacidade:1,profissionaisIds:[idProfissional]}),[400,409])
registrar('GET','servicos/:id','Serviços','Consultar serviço','Retorna dados do procedimento e profissionais.',todos,dados(servico),undefined,[404])
registrar('PATCH','servicos/:id','Serviços','Atualizar serviço','Altera dados ou inativa o serviço. Exige pelo menos um campo.',equipe,dados(servico),corpo(edicaoServico,{valorCentavos:12000}),[400,404,409])

registrar('GET','agenda/ausencias','Agenda','Listar feriados e férias','Lista períodos ativos; inclui ausências gerais da clínica.',equipe,lista(ausencia),consulta(consultaAgenda),[400])
registrar('POST','agenda/ausencias','Agenda','Bloquear período','Bloqueia até 91 dias inclusive. Profissional nulo indica toda a clínica. Atendimentos conflitantes devem ser remarcados antes.',admin,dados(ausencia),corpo(entradaAusencia,{profissionalId:null,dataInicio:'2027-01-01',dataFim:'2027-01-01',motivo:'Feriado'}),[400,409])
registrar('PATCH','agenda/ausencias/:id','Agenda','Reabrir período','Inativa ausência e libera a agenda. Não exige corpo.',admin,dados(ausencia),undefined,[404])
registrar('GET','salas','Agenda','Listar salas','Retorna salas e capacidades.',equipe,lista(sala))
registrar('POST','salas','Agenda','Cadastrar sala','Cria sala com nome único e capacidade.',admin,dados(sala),corpo(entradaSala,{nome:'Sala de exemplo',capacidade:2}),[400,409])
registrar('POST','agendamentos/serie','Agenda','Criar série recorrente','Cria de 2 a 52 sessões com intervalo de 1 a 4 semanas. A transação é integral: conflito impede toda a série.',equipe,dados(z.object({serieId:id,agendamentos:z.array(agendamento)})),corpo(entradaSerie,{...exemploAgendamento,quantidade:4,intervaloSemanas:1}),[400,409])
registrar('GET','agenda/disponibilidade','Agenda','Consultar disponibilidade','Calcula vagas conforme expediente, procedimento, sala, bloqueios e ausências. Não reserva horário.',equipe,dados(z.object({disponivel:booleano,vagasRestantes:inteiro})),consulta(consultaDisponibilidade),[400,404])
registrar('GET','agenda/bloqueios','Agenda','Listar bloqueios','Lista bloqueios ativos que intersectam o período.',equipe,lista(bloqueio),consulta(consultaAgenda),[400])
registrar('POST','agenda/bloqueios','Agenda','Criar bloqueio','Bloqueio dentro de um único dia civil, sem conflito com atendimentos.',equipe,dados(bloqueio),corpo(entradaBloqueio,{profissionalId:idProfissional,...periodo,tipo:'Intervalo'}),[400,409])
registrar('PATCH','agenda/bloqueios/:id','Agenda','Remover bloqueio','Inativa o bloqueio sem excluir o histórico. Não exige corpo.',equipe,dados(bloqueio),undefined,[404])
registrar('GET','agendamentos','Agenda','Listar atendimentos','Consulta intervalo de datas e filtros opcionais por profissional e serviço.',equipe,lista(agendamento),consulta(consultaAgenda),[400])
registrar('POST','agendamentos','Agenda','Agendar atendimento','Valida expediente, duração, capacidade, sala e conflitos em transação.',equipe,dados(agendamento),corpo(entradaAgendamento,exemploAgendamento),[400,409])
registrar('PATCH','agendamentos/:id','Agenda','Atualizar atendimento','Altera horário, paciente, profissional, serviço, sala ou situação; não permite alterar atendimento encerrado.',equipe,dados(agendamento),corpo(edicaoAgendamento,{situacao:'CONFIRMADO'}),[400,404,409])

registrar('GET','clinica/contas','Acessos clínicos','Listar contas clínicas','Lista contas ativas de fisioterapeutas e associação profissional, sem credenciais.',admin,lista(usuario.extend({profissional:z.object({id}).nullable()})))
registrar('POST','clinica/contas','Acessos clínicos','Criar conta clínica','Cria conta de fisioterapeuta e associa ao profissional ativo. Senha de 12 a 128 caracteres.',admin,dados(usuario),corpo(clinica.conta,{profissionalId:idProfissional,email:'fisio@example.test',senha:'SENHA_FICTICIA_123'}),[400,409])
registrar('POST','clinica/associacoes','Acessos clínicos','Associar conta existente','Vincula conta ativa de fisioterapeuta a profissional ainda sem conta.',admin,dados(z.object({profissionalId:id,usuarioId:id})),corpo(clinica.associacao,{profissionalId:idProfissional,usuarioId:'usuario_exemplo'}),[400,409])
registrar('GET','clinica/vinculos','Acessos clínicos','Listar autorizações','Lista vínculos ativos e revogados de um profissional.',admin,lista(z.object({id,pacienteId:id,ativo:booleano,paciente:z.object({nomeCompleto:texto})})),consulta(clinica.consultaVinculos),[400])
registrar('POST','clinica/vinculos','Acessos clínicos','Conceder ou revogar acesso','Autoriza ou revoga a consulta clínica por profissional e paciente.',admin,dados(vinculo),corpo(clinica.vinculo,{pacienteId:idPaciente,profissionalId:idProfissional,ativo:true}),[400],200)
registrar('GET','clinica/pacientes','Prontuário','Listar pacientes autorizados','Somente pacientes com vínculo ativo; 50 por página.',fisio,z.object({dados:z.array(pacienteMinimo),total:inteiro}),consulta(clinica.consultaPacientesClinicos),[400])
registrar('GET','clinica/pacientes/:id/prontuario','Prontuário','Consultar prontuário','Exige vínculo ativo. Retorna registros finalizados, rascunhos do próprio autor e respostas autodeclaradas. Consulta auditada.',fisio,dados(z.object({paciente:pacienteMinimo,entradas:z.array(entradaClinica),formularios:z.array(respostaClinica),usuarioId:id})))
registrar('POST','clinica/pacientes/:id/prontuario','Prontuário','Criar registro clínico','Cria rascunho de anamnese, avaliação, evolução ou adendo. Exige paciente ativo e vínculo.',fisio,dados(entradaClinica),corpo(clinica.entrada,{tipo:'EVOLUCAO',texto:'Registro clínico fictício para documentação.'}),[400,409])
registrar('PATCH','clinica/pacientes/:id/prontuario/:entradaId','Prontuário','Editar ou finalizar registro','Apenas autor pode editar rascunho. Versão deve ser atual; finalização é imutável.',fisio,dados(entradaClinica),corpo(clinica.edicao,{tipo:'EVOLUCAO',texto:'Registro fictício revisado.',versao:1,finalizar:true}),[400,404,409])

registrar('GET','formularios/modelos','Formulários','Listar modelos','Lista publicados por padrão. Apenas administrador pode consultar todos os estados.',equipe,lista(modelo),consulta(formulario.consultaModelos),[400])
registrar('POST','formularios/modelos','Formulários','Criar modelo','Cria rascunho com perguntas validadas, opcionalmente associado a procedimento.',admin,dados(modelo),corpo(formulario.modelo,exemploModelo),[400,409])
registrar('PATCH','formularios/modelos/:id','Formulários','Editar rascunho','Exige revisão atual. Modelos publicados não podem ser modificados.',admin,dados(modelo),corpo(formulario.edicao,{...exemploModelo,revisao:1}),[400,409])
registrar('POST','formularios/modelos/:id/publicar','Formulários','Publicar modelo','Publica a revisão informada; a versão torna-se imutável.',admin,dados(modelo),corpo(formulario.publicacao,{revisao:1}),[400,409],200)
registrar('POST','formularios/modelos/:id/versao','Formulários','Criar nova versão','Copia um modelo publicado sem sucessor para novo rascunho. Preserva versões anteriores.',admin,dados(modelo),undefined,[409])
registrar('GET','formularios/links','Formulários','Listar links de atendimento','Retorna metadados de emissão e resposta, não os tokens nem o conteúdo clínico.',equipe,z.object({dados:z.array(link),atendimento:z.object({id,inicioEm:instante,paciente:z.object({nomeCompleto:texto}),servico:z.object({id,nome:texto})})}),consulta(formulario.consultaLinks),[400,404])
registrar('POST','formularios/links','Formulários','Emitir link individual','Gera token de uso único, exibido apenas na emissão. Validade de 1 a 168 horas; reemissão revoga links pendentes equivalentes.',equipe,dados(link.extend({token})),corpo(formulario.emissao,{modeloId:idModelo,agendamentoId:idAtendimento,validadeHoras:48}),[400,409])
registrar('PATCH','formularios/links/:id','Formulários','Revogar link','Revoga link ainda não respondido. Não exige corpo.',equipe,dados(link),undefined,[409])
registrar('POST','formulario-publico/consultar','Pré-consulta pública','Consultar formulário individual','Token no corpo; retorna perguntas e título, sem identificar paciente. Limite de 30 requisições por minuto.',publico,dados(modeloPublico),corpo(formulario.consultaPublica,{token:exemploToken}),[400,410],200)
registrar('POST','formulario-publico/enviar','Pré-consulta pública','Enviar respostas','Token individual no corpo. Valida campos, tipos e obrigatoriedade. Um envio por link; limite de 15 por minuto.',publico,dados(z.object({enviado:z.literal(true)})),corpo(formulario.envioPublico,{token:exemploToken,respostas:{pergunta1:'Resposta fictícia'}}),[400,410,409])

type Esquema = Record<string, unknown>
function json(schema: z.ZodType): Esquema {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as Esquema
}
const mensagens: Record<number,string> = {
  400:'Dados inválidos ou regra de negócio não atendida',401:'Credenciais ou sessão inválidas',403:'Acesso não autorizado',404:'Registro não encontrado',
  409:'Conflito, duplicidade ou estado incompatível',410:'Link indisponível, expirado ou já respondido',429:'Limite de requisições atingido',500:'Erro interno',503:'Banco indisponível',
}
const exemploCampos: Record<string,unknown> = {
  id:'registro_exemplo',pacienteId:idPaciente,profissionalId:idProfissional,servicoId:idServico,modeloId:idModelo,agendamentoId:idAtendimento,
  usuarioId:'usuario_exemplo',autorId:'usuario_exemplo',entradaId:'entrada_exemplo',token:exemploToken, email:'usuario@example.test',
  nome:'Nome de exemplo',nomeCompleto:'Paciente de exemplo',titulo:'Formulário de exemplo',texto:'Texto fictício',tipo:'EVOLUCAO',
  rotulo:'Pergunta fictícia',inicioEm:periodo.inicioEm,fimEm:periodo.fimEm,valorCentavos:10000,capacidade:1,quantidade:2,pagina:1,limite:20,
}
function exemploEsquema(s: Esquema, chave = ''): unknown {
  if (s.example !== undefined) return s.example
  if (s.enum instanceof Array) return s.enum[0]
  if ('const' in s) return s.const
  if (s.nullable) return null
  if (s.default !== undefined) return s.default
  if (s.anyOf instanceof Array) return exemploEsquema(s.anyOf[0] as Esquema,chave)
  if (s.oneOf instanceof Array) return exemploEsquema(s.oneOf[0] as Esquema,chave)
  if (s.type === 'object') {
    const campos = s.properties as Record<string,Esquema> | undefined
    if (chave === 'respostas' && !campos) return { pergunta1: 'Resposta fictícia' }
    const obrigatorios = Array.isArray(s.required) ? s.required : []
    return Object.fromEntries(Object.entries(campos ?? {}).filter(([k])=>obrigatorios.includes(k)).map(([k,v])=>[k,exemploEsquema(v,k)]))
  }
  if (s.type === 'array') {
    if (chave === 'perguntas') return exemploModelo.perguntas
    return [exemploEsquema(s.items as Esquema ?? {})]
  }
  if (chave in exemploCampos) return exemploCampos[chave]
  if (s.type === 'boolean') return true
  if (s.type === 'integer' || s.type === 'number') return Math.max(1,Number(s.minimum ?? 1))
  if (s.format === 'date-time') return '2027-01-04T12:00:00Z'
  if (s.format === 'date') return '2027-01-04'
  if (s.format === 'email') return 'usuario@example.test'
  return 'Exemplo'
}
function comExemplosNosCampos(schema: z.ZodType) {
  const s = json(schema)
  const props = s.properties as Record<string,Esquema> | undefined
  if (props) for (const [k,v] of Object.entries(props)) v.example = exemploEsquema(v,k)
  return s
}
export const rotasDocumentadas = new Map(definicoes.map(d => [d.metodo + ' ' + d.rota,d]))
export function esquemaDocumentacao(metodo: string, rota: string) {
  const d = rotasDocumentadas.get(metodo + ' ' + rota)
  if (!d) throw new Error('Rota sem documentação OpenAPI: ' + metodo + ' ' + rota)
  const parametros = [...rota.matchAll(/:([a-zA-Z0-9_]+)/g)].map(m=>m[1])
  const saida = json(d.saida)
  const resposta: Record<number,Esquema> = {
    [d.sucesso]: { ...saida, description: d.sucesso===201?'Registro criado':'Operação concluída', example: exemploEsquema(saida) },
  }
  const codigos = new Set([...d.erros,...(d.perfis.length?[401,403]:[]),429,500])
  for (const codigo of codigos) resposta[codigo] = codigo===503
    ? { ...json(z.object({situacao:z.literal('banco indisponível')})),description:mensagens[codigo],example:{situacao:'banco indisponível'} }
    : { ...json(erro),description:mensagens[codigo],example:{erro:mensagens[codigo]} }
  return {
    tags:[d.etiqueta],
    summary:d.resumo,
    description:d.descricao + '\n\n**Perfis autorizados:** ' + (d.perfis.length ? d.perfis.join(', ') : 'Público (sem sessão)'),
    operationId: (metodo+'_'+rota.replace('/api/v1/','')).replace(/[^a-zA-Z0-9_]/g,'_'),
    security: d.perfis.length ? [{BearerToken:[]}] : [],
    ...(parametros.length?{params:comExemplosNosCampos(z.object(Object.fromEntries(parametros.map(k=>[k,id.describe('Identificador do recurso')]))))}:{}),
    ...(d.entrada?.consulta?{querystring:comExemplosNosCampos(d.entrada.consulta)}:{}),
    ...(d.entrada?.corpo?{body:{...json(d.entrada.corpo),example:d.entrada.exemplo}}:{}),
    response:resposta,
  }
}
