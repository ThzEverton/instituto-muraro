'use client'
import { useEffect,useState,type FormEvent,type ReactNode } from 'react'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {SectionHeader} from '@/components/physio/ui'

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
  const parametros=useSearchParams()
  const [perfil,setPerfil]=useState('')
  const [aba,setAba]=useState('Resumo')
  const [erro,setErro]=useState('')
  const [aviso,setAviso]=useState('')
  const [ocupado,setOcupado]=useState(false)
  const [pacientes,setPacientes]=useState<Paciente[]>([])
  const [busca,setBusca]=useState('')
  const [pacienteId,setPacienteId]=useState('')
  const [agendamentoId,setAgendamentoId]=useState('')
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
    setPacientes(r.dados)
  }
  async function carregarCatalogo(){
    const [p,t,l,s,pro,c]=await Promise.all([api<{dados:Parceria[]}>(fin+'parcerias'),api<{dados:Taxa[]}>(fin+'taxas'),api<{dados:Plano[]}>(fin+'planos'),api<{dados:Cadastro[]}>('servicos?ativo=true&limite=100'),api<{dados:Cadastro[]}>('profissionais?ativo=true&limite=100'),api<{dados:Config|null}>('configuracao')])
    setParcerias(p.dados);setTaxas(t.dados);setPlanos(l.dados);setServicos(s.dados);setProfissionais(pro.dados);setConfig(c.dados)
  }
  async function carregarMovimentos(id=pacienteId,p=pagina){
    const q=new URLSearchParams({pagina:String(p),...(id?{pacienteId:id}:{})})
    const [c,b]=await Promise.all([api<{dados:Contrato[];total:number}>(fin+'contratos?'+q),api<{dados:Cobranca[];total:number}>(fin+'cobrancas?'+q)])
    setContratos(c.dados);setCobrancas(b.dados);setTotalContratos(c.total);setTotalCobrancas(b.total);setPagina(p)
  }
  async function carregarPeriodo(a=inicio,b=fim){
    const q=new URLSearchParams({inicio:a,fim:b})
    const [r,d,c]=await Promise.all([api<{dados:Relatorio}>(fin+'relatorio?'+q),api<{dados:Despesa[]}>(fin+'despesas?'+q),api<{dados:Comissao[]}>(fin+'comissoes?'+q)])
    setRelatorio(r.dados);setDespesas(d.dados);setComissoes(c.dados)
  }
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search),id=q.get('paciente')||'',ag=q.get('agendamento')||''
    setPacienteId(id);setAgendamentoId(ag);novaChave()
    if(ag)setAba('Planos')
    const abaInicial=q.get('aba');if(abaInicial&&['Resumo','Planos','Cobranças','Despesas','Comissões','Configurações'].includes(abaInicial))setAba(abaInicial)
    api<{dados:{perfil:string}}>('autenticacao/sessao').then(async r=>{
      setPerfil(r.dados.perfil)
      if(r.dados.perfil==='ADMINISTRADOR'){
        await Promise.all([carregarCatalogo(),carregarMovimentos(id,1),carregarPeriodo(),buscarPacientes('')])
        if(id){const p=await api<{dados:Paciente}>('pacientes/'+encodeURIComponent(id));setPacientes(a=>a.some(x=>x.id===id)?a:[p.dados,...a])}
      }
    }).catch(e=>setErro(mensagem(e)))
  },[])
  useEffect(()=>{const a=parametros.get('aba');if(a&&['Resumo','Planos','Cobranças','Despesas','Comissões','Configurações'].includes(a))setAba(a);else if(!parametros.get('agendamento'))setAba('Resumo')},[parametros])
  async function executar(fn:()=>Promise<unknown>,sucesso:string){
    setOcupado(true);setErro('');setAviso('')
    try{await fn();novaChave();setAviso(sucesso);await Promise.all([carregarCatalogo(),carregarMovimentos(),carregarPeriodo()])}
    catch(e){setErro(mensagem(e))}
    finally{setOcupado(false)}
  }
  function enviar(e:FormEvent<HTMLFormElement>,fn:(f:FormData)=>Promise<unknown>,sucesso:string){
    e.preventDefault();const f=new FormData(e.currentTarget);void executar(()=>fn(f),sucesso)
  }
  const opPacientes=pacientes.map(p=>({id:p.id,nome:p.nomeCompleto}))
  const opPlanos=planos.filter(p=>p.ativo).map(p=>({id:p.id,nome:p.nome+' — '+moeda(p.valorCentavos)}))
  const opParcerias=parcerias.filter(p=>p.ativo).map(p=>({id:p.id,nome:p.nome+' — '+p.descontoPontosBase/100+'%'}))
  const opFormas=formas.map(f=>({id:f,nome:f}))
  const formClass='grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3'
  const acao=(rota:string,metodo:string,corpo?:object)=>api(fin+rota,metodo,corpo)
  const estornar=(rota:string)=>{const motivo=window.prompt('Informe o motivo (mínimo de 3 caracteres)');if(motivo&&motivo.trim().length>=3)void executar(()=>acao(rota,'PATCH',{motivo}),'Operação registrada.')}
  function paginar(n:number){carregarMovimentos(pacienteId,n).catch(e=>setErro(mensagem(e)))}
  const abas=['Resumo','Planos','Cobranças','Despesas','Comissões','Configurações']
  return <div className="m-modulo space-y-5">
    <SectionHeader eyebrow="ADMINISTRAÇÃO" title="Gestão financeira" description="Controle financeiro, planos, recebimentos e repasses."/>
    {erro&&<p role="alert" className="rounded-lg bg-white p-3 text-red-700">{erro}</p>}{aviso&&<p role="status" className="rounded-lg bg-white p-3 text-green-800">{aviso}</p>}
    {!perfil&&<p>Verificando acesso...</p>}
    {perfil&&perfil!=='ADMINISTRADOR'&&<p>Área exclusiva de administração.</p>}
    {perfil==='ADMINISTRADOR'&&<>
      <nav className="flex flex-wrap gap-2">{abas.map(a=><button key={a} disabled={ocupado} onClick={()=>{setAba(a);setErro('');setAviso('')}} className={aba===a?botao:secundario}>{a}</button>)}</nav>
      {['Resumo','Despesas','Comissões'].includes(aba)&&<form className="flex flex-wrap items-end gap-3 m-card" onSubmit={e=>{e.preventDefault();carregarPeriodo().catch(e=>setErro(mensagem(e)))}}><Campo rotulo="De"><input type="date" className={campo} value={inicio} onChange={e=>setInicio(e.target.value)} required/></Campo><Campo rotulo="Até"><input type="date" className={campo} value={fim} onChange={e=>setFim(e.target.value)} required/></Campo><button className={botao}>Aplicar período</button></form>}
      {['Planos','Cobranças'].includes(aba)&&<Painel titulo="Filtro por paciente"><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();buscarPacientes(busca).catch(e=>setErro(mensagem(e)))}}><Campo rotulo="Buscar nome"><input className={campo} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar paciente"/></Campo><button className={secundario}>Buscar</button></form><select className={campo} value={pacienteId} onChange={e=>{setPacienteId(e.target.value);setRenovar(null);setReceber(null);carregarMovimentos(e.target.value,1).catch(e=>setErro(mensagem(e)))}}><option value="">Todos os pacientes</option>{pacientes.map(p=><option key={p.id} value={p.id}>{p.nomeCompleto}</option>)}</select></Painel>}
      {aba==='Resumo'&&relatorio&&<Painel titulo="Resumo de caixa"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['Recebimentos',relatorio.recebimentosCentavos],['Estornos',relatorio.estornosCentavos],['Taxas líquidas',relatorio.taxasCentavos],['Despesas',relatorio.despesasCentavos],['Estornos de despesas',relatorio.estornosDespesasCentavos],['Repasses pagos',relatorio.repassesCentavos],['Saldo do período',relatorio.saldoCentavos],['A receber no vencimento',relatorio.aReceberCentavos]] as [string,number][]).map(([l,n])=><div key={l} className="rounded-xl border p-4"><p className="text-sm text-slate-600">{l}</p><p className="mt-2 text-2xl font-semibold">{moeda(n)}</p></div>)}</div><p className="text-sm text-slate-500">Regime de caixa operacional. A receber corresponde ao saldo atual das cobranças com vencimento no período. Não é demonstrativo contábil.</p></Painel>}
      {aba==='Planos'&&<>
        <Painel titulo={editarPlano?'Editar plano':'Novo plano ou pacote'}><form key={editarPlano?.id??'novo'} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao(editarPlano?'planos/'+editarPlano.id:'planos',editarPlano?'PATCH':'POST',{nome:str(f,'nome'),servicoId:str(f,'servicoId'),modalidade:str(f,'modalidade'),sessoes:num(f,'sessoes'),valorCentavos:centavos(f,'valor'),validadeDias:num(f,'validade')});setEditarPlano(null)},'Plano salvo.')}>
          <Campo rotulo="Nome"><Entrada nome="nome" valor={editarPlano?.nome}/></Campo><Campo rotulo="Serviço"><Escolha nome="servicoId" opcoes={servicos} valor={editarPlano?.servicoId}/></Campo><Campo rotulo="Modalidade"><Escolha nome="modalidade" opcoes={[{id:'PACOTE',nome:'Pacote de sessões'},{id:'MENSALIDADE',nome:'Mensalidade'}]} valor={editarPlano?.modalidade??'PACOTE'}/></Campo><Campo rotulo="Sessões"><Entrada nome="sessoes" tipo="number" min={1} max={365} valor={editarPlano?.sessoes??8}/></Campo><Campo rotulo="Valor total (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01" valor={editarPlano?editarPlano.valorCentavos/100:''}/></Campo><Campo rotulo="Validade em dias"><Entrada nome="validade" tipo="number" min={1} max={3660} valor={editarPlano?.validadeDias??30}/></Campo><button className={botao} disabled={ocupado}>Salvar plano</button>{editarPlano&&<button type="button" className={secundario} onClick={()=>setEditarPlano(null)}>Cancelar edição</button>}
        </form><div className="divide-y">{planos.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 py-3"><div><strong>{p.nome}</strong><p className="text-sm text-slate-600">{p.modalidade} · {p.sessoes} sessões · {moeda(p.valorCentavos)} · {p.ativo?'Ativo':'Inativo'}</p></div><div className="flex gap-2"><button className={secundario} onClick={()=>setEditarPlano(p)}>Editar</button><button className={secundario} disabled={ocupado} onClick={()=>executar(()=>acao('planos/'+p.id,'PATCH',{ativo:!p.ativo}),'Plano atualizado.')}>{p.ativo?'Inativar':'Ativar'}</button></div></div>)}</div></Painel>
        <Painel titulo={renovar?'Renovar contrato':'Contratar plano'}><form key={renovar?.id??pacienteId} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('contratos','POST',{chaveOperacao:chave,pacienteId:renovar?.pacienteId||str(f,'pacienteId'),planoId:str(f,'planoId'),parceriaId:str(f,'parceriaId')||null,...(renovar?{renovacaoDeId:renovar.id}:{}),inicioEm:str(f,'inicio'),primeiroVencimento:str(f,'vencimento'),quantidadeParcelas:num(f,'parcelas')});setRenovar(null)},'Contrato e parcelas registrados.')}>
          {renovar?<p className="text-sm">{renovar.paciente.nomeCompleto} — {renovar.nomePlano}</p>:<Campo rotulo="Paciente"><Escolha nome="pacienteId" opcoes={opPacientes} valor={pacienteId}/></Campo>}<Campo rotulo="Plano"><Escolha nome="planoId" opcoes={opPlanos} valor={renovar?.planoId}/></Campo><Campo rotulo="Parceria (opcional)"><Escolha nome="parceriaId" opcoes={opParcerias} obrigatorio={false} vazio="Sem desconto"/></Campo><Campo rotulo="Início"><Entrada nome="inicio" tipo="date" valor={renovar?new Date(Date.parse(renovar.fimEm)+86400000).toISOString().slice(0,10):hoje()}/></Campo><Campo rotulo="Primeiro vencimento"><Entrada nome="vencimento" tipo="date" valor={renovar?new Date(Date.parse(renovar.fimEm)+86400000).toISOString().slice(0,10):hoje()}/></Campo><Campo rotulo="Parcelas mensais"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><button className={botao} disabled={ocupado||!chave}>{renovar?'Confirmar renovação':'Confirmar contratação'}</button>{renovar&&<button type="button" className={secundario} onClick={()=>setRenovar(null)}>Cancelar renovação</button>}
        </form><p className="text-xs text-slate-500">Cada contrato tem validade definida no plano. A renovação é manual; não existe cobrança automática.</p>
        <div className="divide-y">{contratos.map(c=><article key={c.id} className="space-y-2 py-3"><div className="flex flex-wrap justify-between gap-2"><div><strong>{c.nomePlano} — {c.paciente.nomeCompleto}</strong><p className="text-sm">{data(c.inicioEm)} a {data(c.fimEm)} · {moeda(c.valorFinalCentavos)}</p></div><button className={secundario} onClick={()=>setRenovar(c)}>Renovar</button></div><p className="text-sm">Sessões: {c.sessoesUtilizadas}/{c.sessoesContratadas} utilizadas · {c.sessoesRestantes} restantes</p><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-[#3c897d]" style={{width:(c.sessoesUtilizadas/c.sessoesContratadas*100)+'%'}}/></div>{agendamentoId&&<button className={secundario} disabled={ocupado||c.sessoesRestantes<=0} onClick={()=>{if(window.confirm('Registrar uma sessão deste atendimento?'))void executar(()=>acao('consumos','POST',{contratoId:c.id,agendamentoId}),'Sessão registrada.')}}>Registrar sessão do atendimento selecionado</button>}<details><summary className="cursor-pointer text-sm">Parcelas</summary>{c.cobrancas.map(b=><p key={b.id} className="text-sm">{b.parcela} · {data(b.vencimentoEm)} · {moeda(b.valorCentavos)}</p>)}</details></article>)}</div><div className="flex gap-3"><button className={secundario} disabled={pagina<=1} onClick={()=>paginar(pagina-1)}>Anterior</button><button className={secundario} disabled={pagina*50>=totalContratos} onClick={()=>paginar(pagina+1)}>Próxima</button></div></Painel>
      </>}
      {aba==='Cobranças'&&<>
        <Painel titulo="Cobrança avulsa"><form className={formClass} onSubmit={e=>enviar(e,f=>acao('cobrancas','POST',{chaveOperacao:chave,pacienteId:str(f,'pacienteId'),descricao:str(f,'descricao'),valorCentavos:centavos(f,'valor'),vencimentoEm:str(f,'vencimento')}),'Cobrança criada.')}><Campo rotulo="Paciente"><Escolha nome="pacienteId" opcoes={opPacientes} valor={pacienteId}/></Campo><Campo rotulo="Descrição"><Entrada nome="descricao"/></Campo><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01"/></Campo><Campo rotulo="Vencimento"><Entrada nome="vencimento" tipo="date" valor={hoje()}/></Campo><button disabled={ocupado||!chave} className={botao}>Criar cobrança</button></form></Painel>
        <Painel titulo="Contas a receber">{cobrancas.map(c=><article key={c.id} className="space-y-2 rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><strong>{c.descricao} — {c.paciente.nomeCompleto}</strong><p className="text-sm">{c.situacao} · venc. {data(c.vencimentoEm)} · total {moeda(c.valorCentavos)} · saldo {moeda(c.saldoCentavos)}</p></div><div className="flex gap-2">{c.saldoCentavos>0&&<button className={botao} disabled={ocupado} onClick={()=>setReceber(c)}>Receber</button>}{c.situacao!=='CANCELADA'&&c.valorRecebidoCentavos===0&&<button className={secundario} onClick={()=>estornar('cobrancas/'+c.id+'/cancelar')}>Cancelar</button>}</div></div>
          {receber?.id===c.id&&<form className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('cobrancas/'+c.id+'/recebimentos','POST',{chaveOperacao:chave,valorCentavos:centavos(f,'valor'),formaPagamento:str(f,'forma'),parcelas:num(f,'parcelas'),taxaId:str(f,'taxa')||null});setReceber(null)},'Recebimento registrado.')}><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" valor={c.saldoCentavos/100} min={0.01} max={c.saldoCentavos/100} step="0.01"/></Campo><Campo rotulo="Forma"><Escolha nome="forma" opcoes={opFormas} valor="PIX"/></Campo><Campo rotulo="Parcelas do pagamento"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><Campo rotulo="Taxa (opcional)"><Escolha nome="taxa" opcoes={taxas.map(t=>({id:t.id,nome:t.formaPagamento+' '+t.parcelas+'x · '+t.pontosBase/100+'% · '+data(t.criadaEm)}))} vazio="Sem taxa" obrigatorio={false}/></Campo><button className={botao} disabled={ocupado||!chave}>Confirmar recebimento</button><button type="button" className={secundario} onClick={()=>setReceber(null)}>Fechar</button></form>}
          {c.recebimentos.map(r=><div key={r.id} className="space-y-2 border-t pt-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{moeda(r.valorCentavos)} · {r.formaPagamento} · taxa {moeda(r.taxaCentavos)} {r.estornadoEm?'· Estornado':''}</span>{!r.estornadoEm&&<div className="flex gap-2">{!r.comissao&&<button className={secundario} onClick={()=>setComissionar(r)}>Comissão</button>}<button className={secundario} disabled={ocupado||!!r.comissao?.pagaEm} onClick={()=>estornar('recebimentos/'+r.id+'/estornar')}>Estornar</button></div>}</div>
          {comissionar?.id===r.id&&<form className={formClass} onSubmit={e=>enviar(e,async f=>{await acao('comissoes','POST',{recebimentoId:r.id,profissionalId:str(f,'profissional'),pontosBase:pontos(f,'percentual')});setComissionar(null)},'Comissão registrada.')}><Campo rotulo="Profissional"><Escolha nome="profissional" opcoes={profissionais}/></Campo><Campo rotulo="Comissão sobre líquido (%)"><Entrada nome="percentual" tipo="number" min={0.01} max={100} step="0.01"/></Campo><button className={botao} disabled={ocupado}>Registrar comissão</button><button type="button" className={secundario} onClick={()=>setComissionar(null)}>Fechar</button></form>}</div>)}</article>)}<div className="flex gap-3"><button className={secundario} disabled={pagina<=1} onClick={()=>paginar(pagina-1)}>Anterior</button><button className={secundario} disabled={pagina*50>=totalCobrancas} onClick={()=>paginar(pagina+1)}>Próxima</button></div></Painel>
      </>}
      {aba==='Despesas'&&<Painel titulo="Despesas"><form className={formClass} onSubmit={e=>enviar(e,f=>acao('despesas','POST',{chaveOperacao:chave,descricao:str(f,'descricao'),categoria:str(f,'categoria'),valorCentavos:centavos(f,'valor'),ocorridaEm:str(f,'data')}),'Despesa registrada.')}><Campo rotulo="Descrição"><Entrada nome="descricao"/></Campo><Campo rotulo="Categoria"><Entrada nome="categoria"/></Campo><Campo rotulo="Valor (R$)"><Entrada nome="valor" tipo="number" min={0.01} step="0.01"/></Campo><Campo rotulo="Data"><Entrada nome="data" tipo="date" valor={hoje()}/></Campo><button className={botao} disabled={ocupado||!chave}>Registrar despesa</button></form>{despesas.map(d=><div key={d.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{d.descricao} · {d.categoria} · {moeda(d.valorCentavos)} · {data(d.ocorridaEm)} {d.estornadaEm?'· Estornada':''}</span>{!d.estornadaEm&&<button className={secundario} onClick={()=>estornar('despesas/'+d.id+'/estornar')}>Estornar</button>}</div>)}</Painel>}
      {aba==='Comissões'&&<Painel titulo="Comissões e repasses"><p className="text-sm">Cadastre uma comissão no recebimento correspondente, em Cobranças. Repasse é somente registro interno, sem transferência bancária.</p>{comissoes.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{profissionais.find(p=>p.id===c.profissionalId)?.nome??c.profissionalId} · {moeda(c.valorCentavos)} · {c.canceladaEm?'Cancelada':c.pagaEm?'Paga':'Pendente'}</span>{!c.pagaEm&&!c.canceladaEm&&<button className={secundario} disabled={ocupado} onClick={()=>{if(window.confirm('Confirmar que o repasse foi pago?'))void executar(()=>acao('comissoes/'+c.id+'/pagar','PATCH',{}),'Repasse registrado.')}}>Registrar pagamento</button>}</div>)}</Painel>}
      {aba==='Configurações'&&<>
        <Painel titulo="Dados da clínica"><form key={config?.nome??'nova'} className={formClass} onSubmit={e=>enviar(e,f=>api('configuracao','PATCH',{nome:str(f,'nome'),telefone:str(f,'telefone')||null,email:str(f,'email')||null,endereco:str(f,'endereco')||null}),'Configuração salva.')}><Campo rotulo="Nome"><Entrada nome="nome" valor={config?.nome??'Instituto Muraro'}/></Campo><Campo rotulo="Telefone"><Entrada nome="telefone" valor={config?.telefone??''} obrigatorio={false}/></Campo><Campo rotulo="E-mail"><Entrada nome="email" tipo="email" valor={config?.email??''} obrigatorio={false}/></Campo><Campo rotulo="Endereço"><Entrada nome="endereco" valor={config?.endereco??''} obrigatorio={false}/></Campo><button className={botao} disabled={ocupado}>Salvar</button></form></Painel>
        <Painel titulo={editarParceria?'Editar parceria':'Parcerias e descontos'}><form key={editarParceria?.id??'nova'} className={formClass} onSubmit={e=>enviar(e,async f=>{await acao(editarParceria?'parcerias/'+editarParceria.id:'parcerias',editarParceria?'PATCH':'POST',{nome:str(f,'nome'),descontoPontosBase:pontos(f,'desconto')});setEditarParceria(null)},'Parceria salva.')}><Campo rotulo="Nome"><Entrada nome="nome" valor={editarParceria?.nome}/></Campo><Campo rotulo="Desconto (%)"><Entrada nome="desconto" tipo="number" min={0} max={100} step="0.01" valor={editarParceria?editarParceria.descontoPontosBase/100:0}/></Campo><button className={botao} disabled={ocupado}>Salvar parceria</button>{editarParceria&&<button type="button" className={secundario} onClick={()=>setEditarParceria(null)}>Cancelar edição</button>}</form>{parcerias.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{p.nome} · {p.descontoPontosBase/100}% · {p.ativo?'Ativa':'Inativa'}</span><div className="flex gap-2"><button className={secundario} onClick={()=>setEditarParceria(p)}>Editar</button><button className={secundario} disabled={ocupado} onClick={()=>executar(()=>acao('parcerias/'+p.id,'PATCH',{ativo:!p.ativo}),'Parceria atualizada.')}>{p.ativo?'Inativar':'Ativar'}</button></div></div>)}</Painel>
        <Painel titulo="Taxas por forma de pagamento"><form className={formClass} onSubmit={e=>enviar(e,f=>acao('taxas','POST',{formaPagamento:str(f,'forma'),parcelas:num(f,'parcelas'),pontosBase:pontos(f,'taxa')}),'Nova versão de taxa salva.')}><Campo rotulo="Forma"><Escolha nome="forma" opcoes={opFormas} valor="CREDITO"/></Campo><Campo rotulo="Parcelas"><Entrada nome="parcelas" tipo="number" min={1} max={24} valor={1}/></Campo><Campo rotulo="Taxa (%)"><Entrada nome="taxa" tipo="number" min={0} max={100} step="0.01"/></Campo><button className={botao} disabled={ocupado}>Criar versão</button></form>{taxas.map(t=><div key={t.id} className="border-b py-2 text-sm">{t.formaPagamento} {t.parcelas}x · {t.pontosBase/100}% · {data(t.criadaEm)}</div>)}</Painel>
      </>}
    </>}
  </div>
}
