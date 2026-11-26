import { existsSync, readFileSync } from 'node:fs'

// Tema local: sem CDN ou envio de credenciais a serviços externos.
export const guiaApi = `
Documentação de referência da API operacional do Instituto Muraro.

### Comece por aqui

1. Abra **Saúde da API → Verificar disponibilidade** para conferir a conexão.
2. Abra **Autenticação → Iniciar sessão**, clique em **Try it out**, preencha credenciais de desenvolvimento e execute.
3. Copie somente \`dados.token\`. Clique em **Authorize**, cole o token sem o prefixo Bearer e confirme.
4. Expanda o módulo desejado. Consulte os perfis autorizados, parâmetros, exemplos JSON e códigos de resposta antes de executar.
5. Ao terminar, encerre a sessão em \`POST /api/v1/autenticacao/sair\`.

**Convenções:** valores em centavos (10000 = R$ 100,00); percentuais em pontos-base (100 = 1%); instantes em ISO 8601. Use IDs retornados pela API. A pré-consulta utiliza token individual, distinto da sessão.

**Respostas:** 200/201 (sucesso), 400 (validação), 401/403 (acesso), 404/409 (registro/conflito), 410 (link indisponível), 429 (limite), 500/503 (falha). Cada operação detalha os códigos aplicáveis.

**Ambiente de testes:** os exemplos são fictícios. Executar uma operação de escrita pode alterar o banco conectado. Não utilize dados de pacientes reais ou compartilhe credenciais.

**Exportação:** [OpenAPI JSON](./json) · [OpenAPI YAML](./yaml).
`.trim()
const css = `
:root{--muraro-navy:#142b49;--muraro-blue:#2c628d;--muraro-ink:#243651;--muraro-muted:#53677e;--muraro-border:#dce5ed;--muraro-bg:#f5f7fb}
body{margin:0;background:var(--muraro-bg)}
.swagger-ui,.swagger-ui input,.swagger-ui select,.swagger-ui button,.swagger-ui textarea{font-family:Inter,"Segoe UI",Arial,sans-serif}
.swagger-ui{color:var(--muraro-ink);font-size:14px}
.swagger-ui .wrapper{max-width:1220px;padding:0 24px}
.swagger-ui .topbar{background:var(--muraro-navy);padding:16px 0}
.swagger-ui .topbar .topbar-wrapper{gap:16px}
.swagger-ui .topbar .topbar-wrapper .link{flex:0 1 auto;max-width:100%}
.swagger-ui .topbar .topbar-wrapper img{max-width:260px;width:100%;height:auto}
.swagger-ui .topbar .download-url-wrapper{display:none}
.swagger-ui .info{margin:32px 0 24px}
.swagger-ui .info .title{color:var(--muraro-navy);font-size:32px;letter-spacing:-.6px;line-height:1.2}
.swagger-ui .info .title small{background:#2c628d;vertical-align:middle;margin:4px 8px}
.swagger-ui .info .description{background:#fff;border:1px solid var(--muraro-border);border-radius:16px;padding:20px 24px;margin:16px 0}
.swagger-ui .markdown code,.swagger-ui .renderedMarkdown code{color:#245377;background:#edf4fa}
.swagger-ui .markdown p,.swagger-ui .renderedMarkdown p,.swagger-ui .markdown li,.swagger-ui .renderedMarkdown li{line-height:1.6;color:var(--muraro-ink);font-size:14px}
.swagger-ui .markdown h3,.swagger-ui .renderedMarkdown h3{font-size:17px;color:var(--muraro-navy);margin:20px 0 12px}
.swagger-ui .markdown table,.swagger-ui .renderedMarkdown table{width:100%;border-collapse:collapse;margin:12px 0}
.swagger-ui .markdown table th,.swagger-ui .markdown table td,.swagger-ui .renderedMarkdown table th,.swagger-ui .renderedMarkdown table td{padding:8px 12px;border-bottom:1px solid var(--muraro-border);text-align:left}
.swagger-ui a{color:#245377}
.swagger-ui .scheme-container{padding:16px 0;background:white;border-block:1px solid var(--muraro-border);box-shadow:none;margin:0 0 24px}
.swagger-ui .filter-container{padding:8px 0 16px}
.swagger-ui .filter-container input{width:100%;min-height:44px;border:1px solid #a8b9c9;border-radius:8px;background:#fff;font-size:14px;padding:8px 12px}
.swagger-ui .opblock-tag{margin:8px 0;border:1px solid var(--muraro-border);border-radius:12px;background:white;padding:16px;gap:8px;color:var(--muraro-navy);font-size:18px;line-height:1.4}
.swagger-ui .opblock-tag:hover{background:#edf4fa}
.swagger-ui .opblock-tag small{color:var(--muraro-muted);font-size:13px;font-weight:400;line-height:1.5}
.swagger-ui .opblock{border-radius:10px;box-shadow:none;margin:0 0 12px}
.swagger-ui .opblock .opblock-summary{padding:12px;gap:8px;min-height:48px;flex-wrap:wrap}
.swagger-ui .opblock .opblock-summary-method{min-width:72px;font-size:13px;border-radius:6px}
.swagger-ui .opblock.opblock-get .opblock-summary-method{background:#245c87}
.swagger-ui .opblock.opblock-post .opblock-summary-method{background:#28725a}
.swagger-ui .opblock.opblock-patch .opblock-summary-method{background:#866021}
.swagger-ui .opblock .opblock-summary-path{font-size:14px;overflow-wrap:anywhere;max-width:100%}
.swagger-ui .opblock .opblock-summary-description{color:var(--muraro-ink);font-size:13px}
.swagger-ui .opblock-description-wrapper,.swagger-ui .opblock-section-header,.swagger-ui .parameters-container,.swagger-ui .responses-wrapper{padding:16px}
.swagger-ui .opblock .opblock-section-header{box-shadow:none;background:#fff}
.swagger-ui .opblock .opblock-section-header h4{color:var(--muraro-navy);font-size:14px}
.swagger-ui .parameter__name,.swagger-ui .response-col_status{font-size:14px}
.swagger-ui .parameter__type,.swagger-ui .parameter__in,.swagger-ui .response-col_description{font-size:12px}
.swagger-ui .btn{min-height:40px;border-radius:8px;font-size:13px;box-shadow:none}
.swagger-ui .btn.authorize{background:var(--muraro-navy);border-color:var(--muraro-navy);color:white}
.swagger-ui .btn.authorize svg{fill:white}
.swagger-ui .btn.execute{background:var(--muraro-blue);border-color:var(--muraro-blue)}
.swagger-ui .model-box,.swagger-ui .highlight-code{border-radius:8px}
.swagger-ui .highlight-code>.microlight,.swagger-ui .model-example pre{font-size:13px;line-height:1.6}
.swagger-ui :focus-visible{outline:3px solid #2c628d;outline-offset:3px}
@media(max-width:680px){.swagger-ui .wrapper{padding:0 12px}.swagger-ui .info .title{font-size:24px}.swagger-ui .info .description{padding:16px}.swagger-ui .opblock-tag{font-size:16px;padding:12px}.swagger-ui .opblock-tag small{display:none}.swagger-ui .opblock .opblock-summary-path{font-size:12px}.swagger-ui .opblock .opblock-summary-description{flex-basis:100%}.swagger-ui .opblock-description-wrapper,.swagger-ui .parameters-container,.swagger-ui .responses-wrapper{padding:12px}.swagger-ui .opblock-body{overflow-x:auto}.swagger-ui .markdown table,.swagger-ui .renderedMarkdown table{font-size:12px}}
@media(prefers-reduced-motion:reduce){.swagger-ui *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`
export const temaSwagger = {
  title: 'Instituto Muraro | Documentação da API',
  css: [{ filename: 'muraro.css', content: css }],
}
const arquivoMarca = [
  new URL('../../../public/instituto-muraro-logo.png', import.meta.url),
  new URL('../../../../public/instituto-muraro-logo.png', import.meta.url),
].find(url => existsSync(url))
const imagem = arquivoMarca
  ? '<image x="0" y="5" width="44" height="44" href="data:image/png;base64,' + readFileSync(arquivoMarca).toString('base64') + '"/>'
  : ''
export const marcaSwagger = {
  type: 'image/svg+xml',
  content: '<svg xmlns="http://www.w3.org/2000/svg" width="276" height="54" viewBox="0 0 276 54">' + imagem +
    '<text x="56" y="24" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">Instituto Muraro</text>' +
    '<text x="56" y="43" font-family="Segoe UI,Arial,sans-serif" font-size="12" fill="#d5e5f4">DOCUMENTAÇÃO DA API</text></svg>',
}
