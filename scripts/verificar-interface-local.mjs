import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs'
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
let processo,ws,usuario
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
 await carregar('/sistema/pacientes?novo=1','#form-paciente')
 await preencher('#form-paciente .m-field:first-child input',nome)
 await clicar('Salvar alterações')
 await esperar(async()=>Boolean(await prisma.paciente.findFirst({where:{nomeCompleto:nome}})),'persistência do paciente no PostgreSQL')
 await esperar(()=>avaliar('!document.querySelector("#form-paciente")'),'fechamento do modal')
 await preencher('input[aria-label="Pesquisar"]',nome)
 await aguardarTexto(nome)
 await avaliar('document.querySelector("button[title=\\"Ver perfil\\"]").click()')
 await esperar(()=>avaliar('!!document.querySelector(".m-profile-panel")'),'perfil lateral')
 assert.ok(await avaliar('document.querySelector(".m-profile-panel").innerText.includes('+JSON.stringify(nome)+')'))
 console.log('OK criação e consulta de paciente no modal e tabela originais')
 const paginas=[
  ['/sistema/profissionais','Fisioterapeutas','.m-section-head'],
  ['/sistema/servicos','Serviços e procedimentos','.m-section-head'],
  ['/sistema/agenda','Agenda de atendimentos','.fc'],
  ['/sistema/formularios','Formulários e pré-consulta','.m-section-head'],
  ['/sistema/financeiro?aba=Planos','Contratos de pacientes','.m-section-head'],
  ['/sistema/financeiro?aba=Configura%C3%A7%C3%B5es','Dados da clínica','.m-section-head'],
  ['/sistema/prontuario','Gestão de acessos clínicos','.m-section-head'],
  ['/sistema/comunicacao','Fila de mensagens','.m-section-head']
 ]
 await avaliar('document.querySelector(".m-profile-panel button[aria-label=\\"Fechar perfil\\"]")?.click()')
 for(const [rota,titulo,selector] of paginas){
  const navegou=await avaliar('(()=>{const l=[...document.querySelectorAll(".m-sidebar a")].find(a=>decodeURI(a.getAttribute("href"))===decodeURI('+JSON.stringify(rota)+'));if(!l)return false;l.click();return true})()')
  assert.ok(navegou,'Link no menu: '+rota)
  await aguardarTexto(titulo)
  await esperar(()=>avaliar('document.querySelector('+JSON.stringify(selector)+')!==null'),rota)
  assert.ok(await avaliar('!!document.querySelector(".m-sidebar")'))
  console.log('OK '+rota)
 }
 await avaliar('document.querySelector(".m-sidebar a[href=\\"/sistema/pacientes\\"]").click()')
 await aguardarTexto('Cadastro de pacientes')
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false})
 await aguardar(400)
 assert.equal(await avaliar('document.documentElement.scrollWidth<=innerWidth'),true)
 await clicar('Adicionar paciente')
 await esperar(()=>avaliar('!!document.querySelector("#form-paciente")'),'modal aberto')
 await aguardar(200)
 assert.equal(await avaliar('document.querySelector(".m-dialog").contains(document.activeElement)'),true)
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
 await esperar(()=>avaliar('!document.querySelector("#form-paciente")'),'Escape fecha modal')
 console.log('OK mobile e foco do modal')
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await avaliar('document.querySelector("button[title=Sair]").click()')
 await aguardarTexto('Bem-vindo ao Instituto Muraro')
 assert.equal(await avaliar("fetch('/api/sistema/painel/resumo').then(r=>r.status)"),401)
 console.log('OK logout e bloqueio de API')
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
 await prisma.$disconnect()
}
