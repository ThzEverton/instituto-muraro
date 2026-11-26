import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {existsSync,mkdtempSync,readFileSync,rmSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {prisma} from '../backend/dist/src/configuracoes/banco-de-dados.js'
import {criarHashSenha} from '../backend/dist/src/utilitarios/senhas.js'

const base='http://127.0.0.1:4173'
const navegador=process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
if(!existsSync(navegador))throw new Error('Chrome local não encontrado; informe BROWSER_PATH')
if(!process.env.DATABASE_URL?.includes('@127.0.0.1:5433/'))throw new Error('Teste exclusivo do PostgreSQL local na porta 5433')
const perfil=mkdtempSync(join(tmpdir(),'muraro-interface-'))
const aguardar=ms=>new Promise(r=>setTimeout(r,ms))
const id=randomUUID(),nome='Paciente Interface Sintético '+id
let processo,ws,usuario,servico,plano,parceria,modelo
const pasta=join(process.cwd(),'..','muraro-redesign-validado');mkdirSync(pasta,{recursive:true})
let contador=0
const pendentes=new Map()
async function esperar(fn,descricao,limite=25000){
 const inicio=Date.now()
 while(Date.now()-inicio<limite){try{const r=await fn();if(r)return r}catch{}await aguardar(250)}
 throw new Error('Tempo excedido: '+descricao)
}
function cdp(method,params={}){
 const id=++contador
 return new Promise((resolve,reject)=>{
  pendentes.set(id,{resolve,reject})
  ws.send(JSON.stringify({id,method,params}))
 })
}
async function avaliar(expression){
 const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
 if(r.exceptionDetails)throw new Error('Falha no JavaScript da interface')
 return r.result.value
}
async function carregar(path,selector){
 await cdp('Page.navigate',{url:base+path})
 await esperar(()=>avaliar('document.querySelector('+JSON.stringify(selector)+')!==null'),path)
}
async function aguardarTexto(t){return esperar(()=>avaliar('document.body.innerText.includes('+JSON.stringify(t)+')'),t)}
const clicar=texto=>avaliar('Array.from(document.querySelectorAll("button,a")).find(e=>e.textContent.trim().includes('+JSON.stringify(texto)+'))?.click()')
async function preencher(selector,valor){
 await avaliar('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');if(!el)throw Error("campo inexistente");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(el,'+JSON.stringify(valor)+');el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()')
}
try{
 const email='interface-'+id+'@example.test',senha='Teste!'+randomUUID()
 usuario=await prisma.usuario.create({data:{nome:'Administrador teste interface',email,senhaHash:await criarHashSenha(senha),perfil:'ADMINISTRADOR'}})
 servico=await prisma.servico.create({data:{nome:'Serviço teste de edição '+id,duracaoMinutos:50,valorCentavos:15000}})
 plano=await prisma.planoTratamento.create({data:{nome:'Plano teste '+id,servicoId:servico.id,modalidade:'PACOTE',sessoes:8,valorCentavos:30000,validadeDias:30}})
 parceria=await prisma.parceria.create({data:{nome:'Parceria teste '+id,descontoPontosBase:1000}})
 modelo=await prisma.modeloFormulario.create({data:{titulo:'Modelo teste '+id,versao:1,perguntas:[{id:'q1',rotulo:'Pergunta de teste',tipo:'TEXTO',obrigatoria:true}]}})
 processo=spawn(navegador,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+perfil,'--window-size=1440,1000','about:blank'],{stdio:'ignore',windowsHide:true})
 const porta=await esperar(()=>{const f=join(perfil,'DevToolsActivePort');return existsSync(f)?readFileSync(f,'utf8').split(/\r?\n/)[0]:null},'iniciar Chrome')
 const alvo=await esperar(async()=>{const r=await fetch('http://127.0.0.1:'+porta+'/json/list');return (await r.json()).find(t=>t.type==='page')},'aba de teste')
 ws=new WebSocket(alvo.webSocketDebuggerUrl)
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pendentes.get(m.id);if(p){pendentes.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}})
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
 await cdp('Page.enable')
 await carregar('/','input[type=email]')
 await esperar(()=>avaliar('!!document.querySelector(".m-login-form button[type=submit]:not(:disabled)")'),'login disponível')
 await preencher('input[type=email]',email)
 await preencher('input[type=password]',senha)
 await aguardar(250)
 await avaliar('document.querySelector(".m-login-form button[type=submit]").click()')
 await esperar(()=>avaliar('!!document.querySelector(".m-sidebar") && !!document.querySelector(".m-metric")'),'login e painel')
 await aguardarTexto('Um bom dia para cuidar de pessoas.')
 const resumo=await avaliar("fetch('/api/sistema/painel/resumo').then(async r=>({status:r.status,dados:(await r.json()).dados}))")
 assert.equal(resumo.status,200);assert.ok(resumo.dados.financeiro)
 assert.equal(await avaliar('localStorage.getItem("muraro-physiotherapy-demo-v2")'),null)
 console.log('OK login, menu original, dashboard com dados reais')
 async function menu(rota){assert.ok(await avaliar('(()=>{const l=[...document.querySelectorAll(".m-sidebar a")].find(a=>decodeURI(a.getAttribute("href"))===decodeURI('+JSON.stringify(rota)+'));if(!l)return false;l.click();return true})()'))}
 async function acaoDaLinha(nome,botao){assert.ok(await avaliar('(()=>{const l=[...document.querySelectorAll(".m-table tbody tr")].find(t=>t.innerText.includes('+JSON.stringify(nome)+'));const b=l?.querySelector('+JSON.stringify('button[title="'+botao+'"]')+');if(!b)return false;b.click();return true})()'))}
 async function foto(n){await aguardar(350);const img=await cdp('Page.captureScreenshot',{format:'png'});writeFileSync(join(pasta,n+'.png'),Buffer.from(img.data,'base64'))}
 await menu('/sistema/financeiro');await aguardarTexto('Composição do caixa');await foto('01-financeiro')
 await clicar('Planos');await aguardarTexto('Contratos de pacientes');await foto('02-contratos');await clicar('Catálogo de planos');await aguardarTexto(plano.nome)
 await acaoDaLinha(plano.nome,'Editar plano');await esperar(()=>avaliar('!!document.querySelector("#fin-form")'),'modal editar plano')
 assert.equal(await avaliar('document.querySelector("#fin-form input[name=nome]").value'),plano.nome)
 await foto('03-editar-plano')
 await preencher('#fin-form input[name=nome]','Plano editado '+id)
 await avaliar('document.querySelector("button[form=fin-form]").click()')
 await esperar(async()=> (await prisma.planoTratamento.findUnique({where:{id:plano.id}})).nome==='Plano editado '+id,'persistência da edição do plano')
 await esperar(()=>avaliar('!document.querySelector("#fin-form")'),'fechar edição')
 console.log('OK editar e salvar plano')
 await clicar('Contratos de pacientes');await aguardarTexto('Contratos de pacientes');await clicar('Contratar plano');await esperar(()=>avaliar('!!document.querySelector("#fin-form")'),'modal contratação');await foto('04-contratar-plano');await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await esperar(()=>avaliar('!document.querySelector("#fin-form")'),'cancelar contratação')
 await clicar('Cobranças');await aguardarTexto('Contas a receber');await esperar(()=>avaliar('!!document.querySelector(".m-table")'),'lista cobranças');await foto('05-cobrancas')
 await clicar('Nova cobrança');await esperar(()=>avaliar('!!document.querySelector("#fin-form")'),'nova cobrança');await foto('06-nova-cobranca');await clicar('Cancelar')
 await clicar('Despesas');await aguardarTexto('Histórico de despesas');await foto('07-despesas')
 await clicar('Comissões');await aguardarTexto('Histórico de comissões');await foto('08-comissoes')
 await clicar('Configurações');await aguardarTexto('Dados da clínica');await clicar('Parcerias e descontos');await aguardarTexto(parceria.nome)
 await acaoDaLinha(parceria.nome,'Editar parceria');await esperar(()=>avaliar('!!document.querySelector("#fin-form")'),'modal editar parceria')
 await preencher('#fin-form input[name=desconto]','12.5');await avaliar('document.querySelector("button[form=fin-form]").click()')
 await esperar(async()=> (await prisma.parceria.findUnique({where:{id:parceria.id}})).descontoPontosBase===1250,'persistência da edição de parceria')
 await esperar(()=>avaliar('!document.querySelector("#fin-form")'),'fechar parceria')
 console.log('OK editar e salvar parceria')
 await clicar('Taxas de pagamento');await aguardarTexto('Taxas por forma de pagamento');await foto('09-taxas');await clicar('Ver histórico completo');await aguardarTexto('Exibir últimas versões')
 await menu('/sistema/formularios');await aguardarTexto(modelo.titulo);await foto('10-formularios')
 await acaoDaLinha(modelo.titulo,'Editar modelo');await esperar(()=>avaliar('!!document.querySelector("#modelo-form")'),'modal edição formulário');await foto('11-editar-modelo')
 await preencher('#modelo-form input','Modelo editado '+id);await avaliar('document.querySelector("button[form=modelo-form]").click()')
 await esperar(async()=> (await prisma.modeloFormulario.findUnique({where:{id:modelo.id}})).titulo==='Modelo editado '+id,'persistência da edição do formulário')
 await esperar(()=>avaliar('!document.querySelector("#modelo-form")'),'fechar edição')
 console.log('OK editar e salvar formulário')
 await menu('/sistema/agenda');await aguardarTexto('Agenda de atendimentos');await clicar('Novo agendamento');await esperar(()=>avaliar('!!document.querySelector("#agenda-aberto")'),'modal de agenda')
 assert.equal(await avaliar('document.querySelector("#agenda-aberto select").value'),'')
 await foto('12-novo-atendimento');await clicar('Fechar')
 await menu('/sistema/comunicacao');await aguardarTexto('Fila de mensagens');await foto('13-comunicacao')
 await menu('/sistema/financeiro');await aguardarTexto('Composição do caixa');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await foto('14-financeiro-mobile')
 assert.equal(await avaliar('document.documentElement.scrollWidth<=innerWidth'),true)
 console.log('OK agenda, comunicação e responsividade')
} catch(e){
 if(ws?.readyState===1){try{console.log('Tela no erro:',await avaliar('document.querySelector(".m-login-form .m-form-error")?.innerText ?? document.querySelector(".m-form-error")?.innerText ?? document.querySelector("h1")?.innerText ?? "sem título"'))}catch{}}
 throw e
} finally{
 if(ws)ws.close()
 if(processo){processo.kill();await aguardar(800)}
 try{rmSync(perfil,{recursive:true,force:true})}catch{}
 if(usuario){
  await prisma.usuario.update({where:{id:usuario.id},data:{ativo:false}})
  await prisma.sessaoUsuario.updateMany({where:{usuarioId:usuario.id,revogadaEm:null},data:{revogadaEm:new Date()}})
 }
 await prisma.paciente.updateMany({where:{nomeCompleto:nome},data:{ativo:false}})
 if(modelo)await prisma.modeloFormulario.deleteMany({where:{id:modelo.id,situacao:'RASCUNHO'}})
 if(plano)await prisma.planoTratamento.update({where:{id:plano.id},data:{ativo:false}})
 if(parceria)await prisma.parceria.update({where:{id:parceria.id},data:{ativo:false}})
 if(servico)await prisma.servico.update({where:{id:servico.id},data:{ativo:false}})
 await prisma.$disconnect()
}
