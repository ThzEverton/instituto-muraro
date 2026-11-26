import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAplicacao } from '../src/servidor.js'
import { esquemaDocumentacao, rotasDocumentadas } from '../src/infraestrutura/documentacao/openapi.js'

const aplicacao = criarAplicacao()
type Operacao = {
  operationId: string; summary: string; description: string; tags: string[]; security: object[];
  parameters?: { name: string; in: string; required?: boolean; schema: {example?: unknown} }[];
  requestBody?: { content: Record<string,{schema:{example?:unknown}}> };
  responses: Record<string,{ description:string; content: Record<string,{schema:{example?:unknown}}> }>;
}
type Documento = { openapi:string; paths: Record<string,Record<string,Operacao>>; components:{ securitySchemes: Record<string,{type:string;scheme:string}> } }
let documento: Documento
beforeAll(async () => {
  const app = await aplicacao
  const r = await app.inject('/docs/json')
  expect(r.statusCode).toBe(200)
  documento = r.json()
})
afterAll(async () => { await (await aplicacao).close() })

describe('Documentação OpenAPI operacional', () => {
  it('documenta todas as operações registradas, sem rotas internas do Swagger', () => {
    expect(documento.openapi).toBe('3.0.3')
    const existentes = new Set(Object.entries(documento.paths).flatMap(([caminho,metodos])=>Object.keys(metodos).map(m=>m.toUpperCase()+' '+caminho.replace(/\{([^}]+)\}/g,':$1'))))
    expect(existentes).toEqual(new Set(rotasDocumentadas.keys()))
    expect(existentes.size).toBeGreaterThanOrEqual(48)
    expect(documento.components.securitySchemes.BearerToken).toMatchObject({type:'http',scheme:'bearer'})
    const ids = new Set<string>()
    for (const [chave,d] of rotasDocumentadas) {
      const caminho = d.rota.replace(/:([a-zA-Z0-9_]+)/g,'{$1}')
      const op = documento.paths[caminho][d.metodo.toLowerCase()]
      expect(op.summary,chave).toBeTruthy()
      expect(op.description,chave).toContain('Perfis autorizados')
      expect(op.tags,chave).toContain(d.etiqueta)
      expect(ids.has(op.operationId),chave).toBe(false)
      ids.add(op.operationId)
      expect(op.security,chave).toEqual(d.perfis.length?[{BearerToken:[]}]:[])
      expect(op.responses[d.sucesso],chave).toBeDefined()
      for (const codigo of [...d.erros,429,500,...(d.perfis.length?[401,403]:[])]) expect(op.responses[codigo],chave).toBeDefined()
      for (const param of d.rota.matchAll(/:([a-zA-Z0-9_]+)/g)) expect(op.parameters,chave).toEqual(expect.arrayContaining([expect.objectContaining({name:param[1],in:'path',required:true})]))
      if (d.entrada?.corpo) expect(op.requestBody,chave).toBeDefined()
      if (d.entrada?.consulta) expect(op.parameters?.some(p=>p.in==='query'),chave).toBe(true)
    }
  })
  it('valida exemplos de entradas e saídas usando os schemas Zod', () => {
    for (const [chave,d] of rotasDocumentadas) {
      const schema = esquemaDocumentacao(d.metodo,d.rota)
      const saida = d.saida.safeParse(schema.response[d.sucesso].example)
      expect(saida.success, chave+' saída '+JSON.stringify(saida.error?.issues)).toBe(true)
      if (d.entrada?.corpo) {
        const entrada = d.entrada.corpo.safeParse(d.entrada.exemplo)
        expect(entrada.success,chave+' entrada '+JSON.stringify(entrada.error?.issues)).toBe(true)
      }
      if (d.entrada?.consulta && 'querystring' in schema && schema.querystring) {
        const props = schema.querystring.properties as Record<string,{example:unknown}>
        const consulta = d.entrada.consulta.safeParse(Object.fromEntries(Object.entries(props).map(([k,v])=>[k,v.example])))
        expect(consulta.success,chave+' consulta '+JSON.stringify(consulta.error?.issues)).toBe(true)
      }
    }
  })
  it('entrega interface e YAML e bloqueia registro de nova rota sem documentação', async () => {
    const app = await aplicacao
    expect((await app.inject('/docs/')).statusCode).toBe(200)
    const yaml = await app.inject('/docs/yaml')
    expect(yaml.statusCode).toBe(200)
    expect(yaml.body).toContain('openapi: 3.0.3')
    expect(() => esquemaDocumentacao('GET','/api/v1/nao-documentada')).toThrow('Rota sem documentação')
    const outra = await criarAplicacao()
    try {
      expect(() => outra.get('/api/v1/nao-documentada',async()=>({}))).toThrow('Rota sem documentação')
    } finally { await outra.close() }
  })
})
