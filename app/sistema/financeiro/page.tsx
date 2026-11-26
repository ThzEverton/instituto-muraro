'use client'
import {usePerfilSessao} from '@/lib/sessao-interface'
import { useEffect,useState,useRef,type FormEvent,type ReactNode } from 'react'
import Link from 'next/link'
import {useSearchParams,useRouter} from 'next/navigation'
import {SectionHeader,Metric,Empty,Badge,ErrorNote} from '@/components/physio/ui'

import {WalletCards,TrendingUp,TrendingDown,CalendarDays,Plus} from 'lucide-react'

type Paciente={id:string;nomeCompleto:string}
type Cadastro={id:string;nome:string;ativo:boolean}
type Parceria=Cadastro&{descontoPontosBase:number}
type Plano=Cadastro&{servicoId:string;modalidade:string;sessoes:number;valorCentavos:number;validadeDias:number}
type Taxa={id:string;formaPagamento:string;parcelas:number;pontosBase:number;criadaEm:string}
type Comissao={id:string;recebimentoId:string;profissionalId:string;valorCentavos:number;pagaEm:string|null;canceladaEm:string|null}
type Recebimento={id:string;valorCentavos:number;taxaCentavos:number;formaPagamento:string;estornadoEm:string|null;comissao:Comissao|null}
type Cobranca={id:string;paciente:{nomeCompleto:string};descricao:string;valorCentavos:number;valorRecebidoCentavos:number;saldoCentavos:number;situacao:string;vencimentoEm:string;recebimentos:Recebimento[]}
type Contrato={id:string;pacienteId:string;planoId:string;paciente:{nomeCompleto:string};nomePlano:string;inicioEm:string;fimEm:string;sessoesContratadas:number;sessoesUtilizadas:number;sessoesRestantes:number;valorFinalCentavos:number;cobrancas:{id:string;parcela:number;valorCentavos:number;vencimentoEm:string}[]}
type Despesa={id:string;descricao:string;categoria:string;valorCentavos:number;ocorridaEm:string;estornadaEm:string|null}
type Relatorio={recebimentosCentavos:number;estornosCentavos:number;taxasCentavos:number;despesasCentavos:number;estornosDespesasCentavos:number;repassesCentavos:number;saldoCentavos:number;aReceberCentavos:number}
type Config={nome:string;telefone:string|null;email:string|null;endereco:string|null}
const moeda=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100)
const data=(s:string)=>s.slice(0,10).split('-').reverse().join('/')
const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const campo = 'm-input mt-1 w-full'
const botao = 'm-btn primary'
const secundario = 'm-btn secondary'
const formas=['PIX','DINHEIRO','DEBITO','CREDITO','TRANSFERENCIA','OUTRO']
const mensagem=(e:unknown)=>e instanceof Error?e.message:'Operação indisponível'
async function api<T>(rota:string,metodo='GET',corpo?:object):Promise<T>{
  const r=await fetch('/api/sistema/'+rota,{method:metodo,cache:'no-store',headers:{'Content-Type':'application/json'},...(corpo?{body:JSON.stringify(corpo)}:{})})
  const j=await r.json();if(!r.ok)throw new Error(j.erro||'Operação indisponível');return j
}
const fin='financeiro/'
function Campo({rotulo,children}:{rotulo:string;children:ReactNode}){return <label className="block text-sm font-medium">{rotulo}{children}</label>}
function Entrada({nome,tipo='text',valor='',obrigatorio=true,min,max,step}:{nome:string;tipo?:string;valor?:string|number;obrigatorio?:boolean;min?:number;max?:number;step?:string}){
  return <input name={nome} type={tipo} defaultValue={valor} required={obrigatorio} min={min} max={max} step={step} className={campo}/>
}
function Escolha({nome,opcoes,valor='',vazio='Selecione',obrigatorio=true}:{nome:string;opcoes:{id:string;nome:string}[];valor?:string;vazio?:string;obrigatorio?:boolean}){
  return <select name={nome} defaultValue={valor} required={obrigatorio} className={campo}><option value="">{vazio}</option>{opcoes.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select>
}
function Painel({titulo,children}:{titulo:string;children:ReactNode}){return <section className="space-y-4 m-card"><h2 className="text-xl font-semibold">{titulo}</h2>{children}</section>}
const str=(f:FormData,k:string)=>String(f.get(k)??'').trim()
const num=(f:FormData,k:string)=>Number(f.get(k))
const centavos=(f:FormData,k:string)=>Math.round(num(f,k)*100)
const pontos=(f:FormData,k:string)=>Math.round(num(f,k)*100)

export default function Financeiro(){
  const parametros=useSearchParams(),router=useRouter()
  const [carregandoAba,setCarregandoAba]=useState(true)
  const [filtroCobranca,setFiltroCobranca]=useState('')
  const [buscaCobranca,setBuscaCobranca]=useState('')
  const [visaoPlanos,setVisaoPlanos]=useState('contratos')
  const [novoPlano,setNovoPlano]=useState(false)
  const [novoContrato,setNovoContrato]=useState(false)
  const [novaCobranca,setNovaCobranca]=useState(false)
  const [novaDespesa,setNovaDespesa]=useState(false)
  const requisicaoMovimento=useRef(0)
  const perfil=usePerfilSessao()
  const abaSolicitada=parametros.get('aba')|| (parametros.get('agendamento')?'Planos':'Resumo')
  const aba=['Resumo','Planos','Cobranças','Despesas','Comissões','Configurações'].includes(abaSolicitada)?abaSolicitada:'Resumo'
  const [erro,setErro]=useState('')
  const [aviso,setAviso]=useState('')
  const [ocupado,setOcupado]=useState(false)
  const [pacientes,setPacientes]=useState<Paciente[]>([])
  const [busca,setBusca]=useState('')
  const pacienteId=parametros.get('paciente')||''
  const agendamentoId=parametros.get('agendamento')||''
  const [servicos,setServicos]=useState<Cadastro[]>([])
  const [profissionais,setProfissionais]=useState<Cadastro[]>([])
  const [parcerias,setParcerias]=useState<Parceria[]>([])
  const [planos,setPlanos]=useState<Plano[]>([])
  const [taxas,setTaxas]=useState<Taxa[]>([])
  const [contratos,setContratos]=useState<Contrato[]>([])
  const [cobrancas,setCobrancas]=useState<Cobranca[]>([])
  const [despesas,setDespesas]=useState<Despesa[]>([])
  const [comissoes,setComissoes]=useState<Comissao[]>([])
  const [relatorio,setRelatorio]=useState<Relatorio|null>(null)
  const [config,setConfig]=useState<Config|null>(null)
  const [inicio,setInicio]=useState(()=>hoje().slice(0,7)+'-01')
  const [fim,setFim]=useState(hoje)
  const [pagina,setPagina]=useState(1)
  const [totalContratos,setTotalContratos]=useState(0)
  const [totalCobrancas,setTotalCobrancas]=useState(0)
  const [editarPlano,setEditarPlano]=useState<Plano|null>(null)
  const [editarParceria,setEditarParceria]=useState<Parceria|null>(null)
  const [renovar,setRenovar]=useState<Contrato|null>(null)
  const [receber,setReceber]=useState<Cobranca|null>(null)
  const [comissionar,setComissionar]=useState<Recebimento|null>(null)
  const [chave,setChave]=useState('')
  const novaChave=()=>setChave(crypto.randomUUID())
  async function buscarPacientes(termo:string){
    const r=await api<{dados:Paciente[]}>('pacientes?'+new URLSearchParams({busca:termo,ativo:'true',limite:'100'}))
    setPacientes(anteriores=>{const selecionado=anteriores.find(p=>p.id===pacienteId);return selecionado&&!r.dados.some(p=>p.id===pacienteId)?[selecionado,...r.dados]:r.dados})
  }
  async function carregarCatalogo(grupo=aba){
    if(grupo==='Planos'){
      const [p,l,s]=await Promise.all([api<{dados:Parceria[]}>(fin+'parcerias'),api<{dados:Plano[]}>(fin+'planos'),api<{dados:Cadastro[]}>('servicos?ativo=true&limite=100')])
      setParcerias(p.dados);setPlanos(l.dados);setServicos(s.dados)
    }else if(grupo==='Cobranças'){
      const [t,pro]=await Promise.all([api<{dados:Taxa[]}>(fin+'taxas'),api<{dados:Cadastro[]}>('profissionais?ativo=true&limite=100')]);setTaxas(t.dados);setProfissionais(pro.dados)
    }else if(grupo==='Comissões'){
      setProfissionais((await api<{dados:Cadastro[]}>('profissionais?limite=100')).dados)
    }else if(grupo==='Configurações'){
      const [p,t,c]=await Promise.all([api<{dados:Parceria[]}>(fin+'parcerias'),api<{dados:Taxa[]}>(fin+'taxas'),api<{dados:Config|null}>('configuracao')]);setParcerias(p.dados);setTaxas(t.dados);setConfig(c.dados)
    }
  }
  async function carregarMovimentos(id=pacienteId,p=pagina,grupo=aba){
    const ordem=++requisicaoMovimento.current
    const q=new URLSearchParams({pagina:String(p),...(id?{pacienteId:id}:{})})
    if(grupo==='Planos'){
      const c=await api<{dados:Contrato[];total:number}>(fin+'contratos?'+q);if(ordem!==requisicaoMovimento.current)return;setContratos(c.dados);setTotalContratos(c.total)
    }else if(grupo==='Cobranças'){
      const b=await api<{dados:Cobranca[];total:number}>(fin+'cobrancas?'+q);if(ordem!==requisicaoMovimento.current)return;setCobrancas(b.dados);setTotalCobrancas(b.total)
    }
    setPagina(p)
  }
  async function carregarPeriodo(a=inicio,b=fim,grupo=aba){
    const q=new URLSearchParams({inicio:a,fim:b})
    if(grupo==='Resumo')setRelatorio((await api<{dados:Relatorio}>(fin+'relatorio?'+q)).dados)
    else if(grupo==='Despesas')setDespesas((await api<{dados:Despesa[]}>(fin+'despesas?'+q)).dados)
    else if(grupo==='Comissões')setComissoes((await api<{dados:Comissao[]}>(fin+'comissoes?'+q)).dados)
  }
  useEffect(()=>{novaChave()},[])
  useEffect(()=>{
    if(perfil!=='ADMINISTRADOR')return
    let atual=true
    setCarregandoAba(true);setErro('');setPagina(1)
    const tarefas=[carregarCatalogo(aba),carregarMovimentos(pacienteId,1,aba),carregarPeriodo(inicio,fim,aba)]
    if(['Planos','Cobranças'].includes(aba))tarefas.push(buscarPacientes('').then(async()=>{if(pacienteId){const p=await api<{dados:Paciente}>('pacientes/'+encodeURIComponent(pacienteId));if(atual)setPacientes(a=>a.some(x=>x.id===pacienteId)?a:[p.dados,...a])}}))
    Promise.all(tarefas).catch(e=>{if(atual)setErro(mensagem(e))}).finally(()=>{if(atual)setCarregandoAba(false)})
    return()=>{atual=false}
  },[perfil,aba,pacienteId])
  async function executar(fn:()=>Promise<unknown>,sucesso:string){
    setOcupado(true);setErro('');setAviso('')
    try{
      await fn();novaChave();setAviso(sucesso);setNovoPlano(false);setNovoContrato(false);setNovaCobranca(false);setNovaDespesa(false)
      await Promise.all([carregarCatalogo(),carregarMovimentos(),carregarPeriodo()])
    }catch(e){setErro(mensagem(e))}
    finally{setOcupado(false)}
  }
  function enviar(e:FormEvent<HTMLFormElement>,fn:(f:FormData)=>Promise<unknown>,sucesso:string){
    e.preventDefault();const f=new FormData(e.currentTarget);void executar(()=>fn(f),sucesso)
  }
  const opPacientes=pacientes.map(p=>({id:p.id,nome:p.nomeCompleto}))
  const opPlanos=planos.filter(p=>p.ativo).map(p=>({id:p.id,nome:p.nome+' — '+moeda(p.valorCentavos)}))
  const opParcerias=parcerias.filter(p=>p.ativo).map(p=>({id:p.id,nome:p.nome+' — '+p.descontoPontosBase/100+'%'}))
  const opFormas=formas.map(f=>({id:f,nome:f}))
  const formClass='m-fin-form grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3'
  const acao=(rota:string,metodo:string,corpo?:object)=>api(fin+rota,metodo,corpo)
  const estornar=(rota:string)=>{const motivo=window.prompt('Informe o motivo (mínimo de 3 caracteres)');if(motivo&&motivo.trim().length>=3)void executar(()=>acao(rota,'PATCH',{motivo}),'Operação registrada.')}
  function paginar(n:number){carregarMovimentos(pacienteId,n).catch(e=>setErro(mensagem(e)))}
  const nomesStatus:Record<string,string>={PENDENTE:'Pendente',PARCIAL:'Parcial',PAGA:'Paga',VENCIDA:'Vencida',CANCELADA:'Cancelada',ESTORNADA:'Estornada'}
  const cobrancasVisiveis=cobrancas.filter(c=>(!filtroCobranca||c.situacao===filtroCobranca)&&(!buscaCobranca||(c.descricao+' '+c.paciente.nomeCompleto).toLocaleLowerCase('pt-BR').includes(buscaCobranca.toLocaleLowerCase('pt-BR'))))
  const abas=['Resumo','Planos','Cobranças','Despesas','Comissões','Configurações']
  return <div className="m-modulo space-y-5">
    <SectionHeader eyebrow="ADMINISTRAÇÃO" title={aba==="Planos"?"Planos e mensalidades":aba==="Configurações"?"Configurações da clínica":"Gestão financeira"} description="Controle financeiro, planos, recebimentos e repasses."/>
    {erro&&<p role="alert" className="rounded-lg bg-white p-3 text-red-700">{erro}</p>}{aviso&&<p role="status" className="rounded-lg bg-white p-3 text-green-800">{aviso}</p>}
    {!perfil&&<p>Verificando acesso...</p>}
    {perfil&&perfil!=='ADMINISTRADOR'&&<p>Área exclusiva de administração.</p>}
    {perfil==='ADMINISTRADOR'&&<>
      <nav className="m-fin-tabs flex flex-wrap gap-2" aria-label="Seções financeiras">{abas.map(a=><button key={a} aria-pressed={aba===a} disabled={ocupado} onClick={()=>{const q=new URLSearchParams(parametros.toString());if(a==='Resumo')q.delete('aba');else q.set('aba',a);q.delete('agendamento');if(pacienteId)q.set('paciente',pacienteId);router.replace('/sistema/financeiro'+(q.size?'?'+q:''),{scroll:false});setErro('');setAviso('')}} className={aba===a?botao:secundario}>{a}</button>)}</nav>
      {carregandoAba?<div className="m-card" role="status">Carregando informações...</div>:<>
      {['Resumo','Despesas','Comissões'].includes(aba)&&<form className="flex flex-wrap items-end gap-3 m-card" onSubmit={e=>{e.preventDefault();carregarPeriodo().catch(e=>setErro(mensagem(e)))}}><Campo rotulo="De"><input type="date" className={campo} value={inicio} onChange={e=>setInicio(e.target.value)} required/></Campo><Campo rotulo="Até"><input type="date" className={campo} value={fim} onChange={e=>setFim(e.target.value)} required/></Campo><button className={botao}>Aplicar período</button></form>}
      {['Planos','Cobranças'].includes(aba)&&<Painel titulo="Filtro por paciente"><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();buscarPacientes(busca).catch(e=>setErro(mensagem(e)))}}><Campo rotulo="Buscar nome"><input className={campo} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar paciente"/></Campo><button className={secundario}>Buscar</button></form><select className={campo} value={pacienteId} onChange={e=>{const q=new URLSearchParams(parametros.toString());if(e.target.value)q.set('paciente',e.target.value);else q.delete('paciente');q.delete('agendamento');setRenovar(null);setReceber(null);router.replace('/sistema/financeiro'+(q.size?'?'+q:''),{scroll:false})}}><option value="">Todos os pacientes</option>{pacientes.map(p=><option key={p.id} value={p.id}>{p.nomeCompleto}</option>)}</select></Painel>}
       {aba==='Resumo'&&relatorio&&<><div className="m-metrics m-fin-metrics">
      <Metric label="Saldo do período" value={moeda(relatorio.saldoCentavos)} caption="Após taxas, despesas e repasses" icon={<WalletCards size={20}/>} accent="navy"/>
      <Metric label="Recebimentos" value={moeda(relatorio.recebimentosCentavos)} caption="Entradas brutas" icon={<TrendingUp size={20}/>} accent="teal"/>
      <Metric label="Despesas" value={moeda(relatorio.despesasCentavos)} caption="Saídas registradas" icon={<TrendingDown size={20}/>} accent="amber"/>
      <Metric label="A receber" value={moeda(relatorio.aReceberCentavos)} caption="Vencimentos no período" icon={<CalendarDays size={20}/>}/>
    </div><Painel titulo="Composição do caixa"><dl className="m-fin-resumo">{([['Recebimentos',relatorio.recebimentosCentavos],['Estornos',relatorio.estornosCentavos],['Taxas líquidas',relatorio.taxasCentavos],['Despesas',relatorio.despesasCentavos],['Estornos de despesas',relatorio.estornosDespesasCentavos],['Repasses pagos',relatorio.repassesCentavos]] as [string,number][]).map(([l,n])=><div key={l}><dt>{l}</dt><dd>{moeda(n)}</dd></div>)}</dl><p className="text-sm text-slate-500">Regime de caixa operacional. A receber corresponde ao saldo atual das cobranças com vencimento no período. Não é demonstrativo contábil.</p></Painel></>}
      {aba==='Planos'&&<>
        <div className="m-segmented m-subtabs"><button className={visaoPlanos==='contratos'?'active':''} onClick={()=>setVisaoPlanos('contratos')}>Contratos de pacientes</button><button className={visaoPlanos==='catalogo'?'active':''} onClick={()=>setVisaoPlanos('catalogo')}>Catálogo de planos</button></div>
        {visaoPlanos==='catalogo'&&<Painel titulo={editarPlano?'Editar plano':'Catálogo de planos'}><button className={botao} onClick={()=>setNovoPlano(!novoPlano)}><Plus size={16}/>{novoPlano?'Fechar formulário':'Novo plano ou pacote'}</button>{(novoPlano||editarPlano)&&<form key={editarPlano?.id??'novo'} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao(editarPlano?'planos/'+editarPlano.id:'planos',editarPlano?'PATCH':'POST',{nome:str(f,'nome'),servicoId:str(f,'servicoId'),modalidade:str(f,'modalidade'),sessoes:num(f,'sessoes'),valorCentavos:centavos(f,'valor'),validadeDias:num(f,'validade')});setEditarPlano(null)},'Plano salvo.')}>
          <Campo rotulo="Nome"><Entrada nome="nome" valor={editarPlano?.nome}/></Campo><Campo rotulo="Serviço"><Escolha nome="servicoId" opcoes={servicos} valor={editarPlano?.servicoId}/></Campo><Campo rotulo="Modalidade"><Escolha nome="modalidade" opcoes={[{id:'PACOTE',nome:'Pacote de sessões'},{id:'MENSALIDADE',nome:'Mensalidade'}]} valor={editarPlano?.modalidade??'PACOTE'}/></Campo><Campo rotulo="Sessões"><Entrada nome="sessoes" tipo="number" min={1} max={365} valor={editarPlano?.sessoes??8}/></Campo><Campo rotulo="Valor total (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01" valor={editarPlano?editarPlano.valorCentavos/100:''}/></Campo><Campo rotulo="Validade em dias"><Entrada nome="validade" tipo="number" min={1} max={3660} valor={editarPlano?.validadeDias??30}/></Campo><button className={botao} disabled={ocupado}>Salvar plano</button>{editarPlano&&<button type="button" className={secundario} onClick={()=>setEditarPlano(null)}>Cancelar edição</button>}
        </form>}<div className="divide-y">{!planos.length&&<Empty title="Nenhum plano cadastrado" description="Crie o primeiro pacote ou mensalidade."/>}{planos.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 py-3"><div><strong>{p.nome}</strong><p className="text-sm text-slate-600">{p.modalidade} · {p.sessoes} sessões · {moeda(p.valorCentavos)} · {p.ativo?'Ativo':'Inativo'}</p></div><div className="flex gap-2"><button className={secundario} onClick={()=>setEditarPlano(p)}>Editar</button><button className={secundario} disabled={ocupado} onClick={()=>executar(()=>acao('planos/'+p.id,'PATCH',{ativo:!p.ativo}),'Plano atualizado.')}>{p.ativo?'Inativar':'Ativar'}</button></div></div>)}</div></Painel>}
        {visaoPlanos==='contratos'&&<Painel titulo={renovar?'Renovar contrato':'Contratos de pacientes'}><button className={botao} onClick={()=>setNovoContrato(!novoContrato)}><Plus size={16}/>{novoContrato?'Fechar formulário':'Contratar plano'}</button>{(novoContrato||renovar)&&<form key={renovar?.id??pacienteId} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('contratos','POST',{chaveOperacao:chave,pacienteId:renovar?.pacienteId||str(f,'pacienteId'),planoId:str(f,'planoId'),parceriaId:str(f,'parceriaId')||null,...(renovar?{renovacaoDeId:renovar.id}:{}),inicioEm:str(f,'inicio'),primeiroVencimento:str(f,'vencimento'),quantidadeParcelas:num(f,'parcelas')});setRenovar(null)},'Contrato e parcelas registrados.')}>
          {renovar?<p className="text-sm">{renovar.paciente.nomeCompleto} — {renovar.nomePlano}</p>:<Campo rotulo="Paciente"><Escolha nome="pacienteId" opcoes={opPacientes} valor={pacienteId}/></Campo>}<Campo rotulo="Plano"><Escolha nome="planoId" opcoes={opPlanos} valor={renovar?.planoId}/></Campo><Campo rotulo="Parceria (opcional)"><Escolha nome="parceriaId" opcoes={opParcerias} obrigatorio={false} vazio="Sem desconto"/></Campo><Campo rotulo="Início"><Entrada nome="inicio" tipo="date" valor={renovar?new Date(Date.parse(renovar.fimEm)+86400000).toISOString().slice(0,10):hoje()}/></Campo><Campo rotulo="Primeiro vencimento"><Entrada nome="vencimento" tipo="date" valor={renovar?new Date(Date.parse(renovar.fimEm)+86400000).toISOString().slice(0,10):hoje()}/></Campo><Campo rotulo="Parcelas mensais"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><button className={botao} disabled={ocupado||!chave}>{renovar?'Confirmar renovação':'Confirmar contratação'}</button>{renovar&&<button type="button" className={secundario} onClick={()=>setRenovar(null)}>Cancelar renovação</button>}
        </form>}<p className="text-xs text-slate-500">Cada contrato tem validade definida no plano. A renovação é manual; não existe cobrança automática.</p>
        <div className="divide-y">{!contratos.length&&<Empty title="Nenhum contrato encontrado" description="Selecione outro paciente ou contrate um plano."/>}{contratos.map(c=><article key={c.id} className="space-y-2 py-3"><div className="flex flex-wrap justify-between gap-2"><div><strong>{c.nomePlano} — {c.paciente.nomeCompleto}</strong><p className="text-sm">{data(c.inicioEm)} a {data(c.fimEm)} · {moeda(c.valorFinalCentavos)}</p></div><button className={secundario} onClick={()=>setRenovar(c)}>Renovar</button></div><p className="text-sm">Sessões: {c.sessoesUtilizadas}/{c.sessoesContratadas} utilizadas · {c.sessoesRestantes} restantes</p><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-[#3c897d]" style={{width:(c.sessoesUtilizadas/c.sessoesContratadas*100)+'%'}}/></div>{agendamentoId&&<button className={secundario} disabled={ocupado||c.sessoesRestantes<=0} onClick={()=>{if(window.confirm('Registrar uma sessão deste atendimento?'))void executar(()=>acao('consumos','POST',{contratoId:c.id,agendamentoId}),'Sessão registrada.')}}>Registrar sessão do atendimento selecionado</button>}<details><summary className="cursor-pointer text-sm">Parcelas</summary>{c.cobrancas.map(b=><p key={b.id} className="text-sm">{b.parcela} · {data(b.vencimentoEm)} · {moeda(b.valorCentavos)}</p>)}</details></article>)}</div><div className="flex gap-3"><button className={secundario} disabled={pagina<=1} onClick={()=>paginar(pagina-1)}>Anterior</button><button className={secundario} disabled={pagina*50>=totalContratos} onClick={()=>paginar(pagina+1)}>Próxima</button></div></Painel>}
      </>}
      {aba==='Cobranças'&&<>
        <Painel titulo="Nova cobrança"><button className={botao} onClick={()=>setNovaCobranca(!novaCobranca)}><Plus size={16}/>{novaCobranca?"Fechar formulário":"Cobrança avulsa"}</button>{novaCobranca&&<form className={formClass} onSubmit={e=>enviar(e,f=>acao('cobrancas','POST',{chaveOperacao:chave,pacienteId:str(f,'pacienteId'),descricao:str(f,'descricao'),valorCentavos:centavos(f,'valor'),vencimentoEm:str(f,'vencimento')}),'Cobrança criada.')}><Campo rotulo="Paciente"><Escolha nome="pacienteId" opcoes={opPacientes} valor={pacienteId}/></Campo><Campo rotulo="Descrição"><Entrada nome="descricao"/></Campo><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01"/></Campo><Campo rotulo="Vencimento"><Entrada nome="vencimento" tipo="date" valor={hoje()}/></Campo><button disabled={ocupado||!chave} className={botao}>Criar cobrança</button></form>}</Painel>
        <Painel titulo="Contas a receber"><div className="m-filterbar"><input className={campo} aria-label="Buscar cobranças" placeholder="Buscar nesta página" value={buscaCobranca} onChange={e=>setBuscaCobranca(e.target.value)}/><select aria-label="Situação da cobrança" value={filtroCobranca} onChange={e=>setFiltroCobranca(e.target.value)}><option value="">Todas as situações</option>{Object.entries(nomesStatus).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>{!cobrancasVisiveis.length&&<Empty title="Nenhuma cobrança encontrada" description="Ajuste os filtros ou cadastre uma cobrança."/>}{cobrancasVisiveis.map(c=><article key={c.id} className="space-y-2 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><strong>{c.descricao} — {c.paciente.nomeCompleto}</strong><p className="text-sm"><Badge tone={c.situacao==="PAGA"?"green":c.situacao==="VENCIDA"?"red":"amber"}>{nomesStatus[c.situacao]??c.situacao}</Badge> · venc. {data(c.vencimentoEm)} · total {moeda(c.valorCentavos)} · saldo {moeda(c.saldoCentavos)}</p></div><div className="flex gap-2">{c.saldoCentavos>0&&<button className={botao} disabled={ocupado} onClick={()=>setReceber(c)}>Receber</button>}{c.situacao!=='CANCELADA'&&c.valorRecebidoCentavos===0&&<button className={secundario} onClick={()=>estornar('cobrancas/'+c.id+'/cancelar')}>Cancelar</button>}</div></div>
          {receber?.id===c.id&&<form className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('cobrancas/'+c.id+'/recebimentos','POST',{chaveOperacao:chave,valorCentavos:centavos(f,'valor'),formaPagamento:str(f,'forma'),parcelas:num(f,'parcelas'),taxaId:str(f,'taxa')||null});setReceber(null)},'Recebimento registrado.')}><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" valor={c.saldoCentavos/100} min={0.01} max={c.saldoCentavos/100} step="0.01"/></Campo><Campo rotulo="Forma"><Escolha nome="forma" opcoes={opFormas} valor="PIX"/></Campo><Campo rotulo="Parcelas do pagamento"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><Campo rotulo="Taxa (opcional)"><Escolha nome="taxa" opcoes={taxas.map(t=>({id:t.id,nome:t.formaPagamento+' '+t.parcelas+'x · '+t.pontosBase/100+'% · '+data(t.criadaEm)}))} vazio="Sem taxa" obrigatorio={false}/></Campo><button className={botao} disabled={ocupado||!chave}>Confirmar recebimento</button><button type="button" className={secundario} onClick={()=>setReceber(null)}>Fechar</button></form>}
          {c.recebimentos.map(r=><div key={r.id} className="space-y-2 border-t pt-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{moeda(r.valorCentavos)} · {r.formaPagamento} · taxa {moeda(r.taxaCentavos)} {r.estornadoEm?'· Estornado':''}</span>{!r.estornadoEm&&<div className="flex gap-2">{!r.comissao&&<button className={secundario} onClick={()=>setComissionar(r)}>Comissão</button>}<button className={secundario} disabled={ocupado||!!r.comissao?.pagaEm} onClick={()=>estornar('recebimentos/'+r.id+'/estornar')}>Estornar</button></div>}</div>
          {comissionar?.id===r.id&&<form className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('comissoes','POST',{recebimentoId:r.id,profissionalId:str(f,'profissional'),pontosBase:pontos(f,'percentual')});setComissionar(null)},'Comissão registrada.')}><Campo rotulo="Profissional"><Escolha nome="profissional" opcoes={profissionais}/></Campo><Campo rotulo="Comissão sobre líquido (%)"><Entrada nome="percentual" tipo="number" min={0.01} max={100} step="0.01"/></Campo><button className={botao} disabled={ocupado}>Registrar comissão</button><button type="button" className={secundario} onClick={()=>setComissionar(null)}>Fechar</button></form>}</div>)}</article>)}<div className="flex gap-3"><button className={secundario} disabled={pagina<=1} onClick={()=>paginar(pagina-1)}>Anterior</button><button className={secundario} disabled={pagina*50>=totalCobrancas} onClick={()=>paginar(pagina+1)}>Próxima</button></div></Painel>
      </>}
      {aba==='Despesas'&&<Painel titulo="Despesas"><button className={botao} onClick={()=>setNovaDespesa(!novaDespesa)}><Plus size={16}/>{novaDespesa?"Fechar formulário":"Nova despesa"}</button>{novaDespesa&&<form className={formClass} onSubmit={e=>enviar(e,f=>acao('despesas','POST',{chaveOperacao:chave,descricao:str(f,'descricao'),categoria:str(f,'categoria'),valorCentavos:centavos(f,'valor'),ocorridaEm:str(f,'data')}),'Despesa registrada.')}><Campo rotulo="Descrição"><Entrada nome="descricao"/></Campo><Campo rotulo="Categoria"><Entrada nome="categoria"/></Campo><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01"/></Campo><Campo rotulo="Data"><Entrada nome="data" tipo="date" valor={hoje()}/></Campo><button className={botao} disabled={ocupado||!chave}>Registrar despesa</button></form>}{!despesas.length&&<Empty title="Nenhuma despesa no período" description="Altere o período ou registre uma despesa."/>}{despesas.map(d=><div key={d.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{d.descricao} · {d.categoria} · {moeda(d.valorCentavos)} · {data(d.ocorridaEm)} {d.estornadaEm?'· Estornada':''}</span>{!d.estornadaEm&&<button className={secundario} onClick={()=>estornar('despesas/'+d.id+'/estornar')}>Estornar</button>}</div>)}</Painel>}
      {aba==='Comissões'&&<Painel titulo="Comissões e repasses"><p className="text-sm">Cadastre uma comissão no recebimento correspondente, em Cobranças. Repasse é somente registro interno, sem transferência bancária.</p><div className="m-fin-resumo"><div><dt>Pendentes no período</dt><dd>{moeda(comissoes.filter(c=>!c.pagaEm&&!c.canceladaEm).reduce((t,c)=>t+c.valorCentavos,0))}</dd></div><div><dt>Pagas no período</dt><dd>{moeda(comissoes.filter(c=>c.pagaEm&&!c.canceladaEm).reduce((t,c)=>t+c.valorCentavos,0))}</dd></div></div>{!comissoes.length&&<Empty title="Nenhuma comissão no período" description="Registre comissões a partir dos recebimentos."/>}{comissoes.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{profissionais.find(p=>p.id===c.profissionalId)?.nome??c.profissionalId} · {moeda(c.valorCentavos)} · {c.canceladaEm?'Cancelada':c.pagaEm?'Paga':'Pendente'}</span>{!c.pagaEm&&!c.canceladaEm&&<button className={secundario} disabled={ocupado} onClick={()=>{if(window.confirm('Confirmar que o repasse foi pago?'))void executar(()=>acao('comissoes/'+c.id+'/pagar','PATCH',{}),'Repasse registrado.')}}>Registrar pagamento</button>}</div>)}</Painel>}
      {aba==='Configurações'&&<>
        <Painel titulo="Dados da clínica"><form key={config?.nome??'nova'} className={formClass} onSubmit={e=>enviar(e,f=>api('configuracao','PATCH',{nome:str(f,'nome'),telefone:str(f,'telefone')||null,email:str(f,'email')||null,endereco:str(f,'endereco')||null}),'Configuração salva.')}><Campo rotulo="Nome"><Entrada nome="nome" valor={config?.nome??'Instituto Muraro'}/></Campo><Campo rotulo="Telefone"><Entrada nome="telefone" valor={config?.telefone??''} obrigatorio={false}/></Campo><Campo rotulo="E-mail"><Entrada nome="email" tipo="email" valor={config?.email??''} obrigatorio={false}/></Campo><Campo rotulo="Endereço"><Entrada nome="endereco" valor={config?.endereco??''} obrigatorio={false}/></Campo><button className={botao} disabled={ocupado}>Salvar</button></form></Painel>
        <Painel titulo={editarParceria?'Editar parceria':'Parcerias e descontos'}><form key={editarParceria?.id??'nova'} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao(editarParceria?'parcerias/'+editarParceria.id:'parcerias',editarParceria?'PATCH':'POST',{nome:str(f,'nome'),descontoPontosBase:pontos(f,'desconto')});setEditarParceria(null)},'Parceria salva.')}><Campo rotulo="Nome"><Entrada nome="nome" valor={editarParceria?.nome}/></Campo><Campo rotulo="Desconto (%)"><Entrada nome="desconto" tipo="number" min={0} max={100} step="0.01" valor={editarParceria?editarParceria.descontoPontosBase/100:0}/></Campo><button className={botao} disabled={ocupado}>Salvar parceria</button>{editarParceria&&<button type="button" className={secundario} onClick={()=>setEditarParceria(null)}>Cancelar edição</button>}</form>{parcerias.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{p.nome} · {p.descontoPontosBase/100}% · {p.ativo?'Ativa':'Inativa'}</span><div className="flex gap-2"><button className={secundario} onClick={()=>setEditarParceria(p)}>Editar</button><button className={secundario} disabled={ocupado} onClick={()=>executar(()=>acao('parcerias/'+p.id,'PATCH',{ativo:!p.ativo}),'Parceria atualizada.')}>{p.ativo?'Inativar':'Ativar'}</button></div></div>)}</Painel>
        <Painel titulo="Taxas por forma de pagamento"><form className={formClass} onSubmit={e=>enviar(e,f=>acao('taxas','POST',{formaPagamento:str(f,'forma'),parcelas:num(f,'parcelas'),pontosBase:pontos(f,'taxa')}),'Nova versão de taxa salva.')}><Campo rotulo="Forma"><Escolha nome="forma" opcoes={opFormas} valor="CREDITO"/></Campo><Campo rotulo="Parcelas"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><Campo rotulo="Taxa (%)"><Entrada nome="taxa" tipo="number" min={0} max={100} step="0.01"/></Campo><button className={botao} disabled={ocupado}>Criar versão</button></form>{taxas.map(t=><div key={t.id} className="border-b py-2 text-sm">{t.formaPagamento} {t.parcelas}x · {t.pontosBase/100}% · {data(t.criadaEm)}</div>)}</Painel>
      </>}
    </>}
    </>}
  </div>
}
