# Documentação da API operacional

## Acesso local

Na raiz do projeto, com PostgreSQL local configurado, execute `corepack pnpm --dir backend dev`. O backend usa a porta 3333 por padrão.

- Swagger UI: http://localhost:3333/docs/
- OpenAPI JSON: http://localhost:3333/docs/json
- OpenAPI YAML: http://localhost:3333/docs/yaml

As operações são organizadas por módulo. A lista e a cobertura são verificadas automaticamente nos testes. A documentação representa o servidor operacional em `backend/src/servidor.ts`, não o servidor demonstrativo legado.

## Autenticação

1. Execute POST /api/v1/autenticacao/entrar com credenciais de desenvolvimento válidas.
2. Copie somente o token retornado em dados.token e utilize Authorize na interface Swagger.
3. O cabeçalho Authorization é enviado no formato Bearer TOKEN. O token é opaco (não JWT), dura oito horas e pode ser revogado por POST /api/v1/autenticacao/sair.
4. Verifique os perfis autorizados em cada operação. Não use dados reais nos exemplos nem compartilhe tokens de sessão.

As duas operações públicas de pré-consulta utilizam o token individual do formulário no corpo da requisição; não utilizam Bearer de sessão.

## Manutenção obrigatória

Para cada nova rota operacional /api/v1/:

1. Implemente a validação Zod e as regras de autorização no módulo correspondente.
2. Registre a operação em `backend/src/infraestrutura/documentacao/openapi.ts` com método, caminho, grupo, descrição, perfis, schema Zod de entrada (quando existir), schema de saída explícito, exemplo fictício, status de sucesso e erros.
3. Utilize os mesmos schemas de entrada do backend; não duplique as validações. Refinamentos que não são traduzíveis para JSON Schema (CPF, datas relacionadas, regras de concorrência e autorização por vínculo) devem ser descritos em texto.
4. Documente exclusivamente os campos efetivamente retornados, sem hashes de senhas, credenciais reais ou dados sensíveis de exemplo.
5. Execute `corepack pnpm backend:build` e `corepack pnpm backend:test`. O teste de documentação verifica cobertura, unicidade de operationId, segurança, parâmetros, respostas, exemplos Zod e endpoints JSON/YAML/UI.

O transformador do Swagger apenas documenta. Os schemas de saída são contratos de documentação e não alteram a serialização nem substituem as validações do servidor. Atualize-os quando o retorno de uma rota mudar. O hook onRoute impede registrar operações novas sem documentação.

## Produção

A interface Swagger é desabilitada por padrão quando NODE_ENV=production. Habilitar SWAGGER_HABILITADO=true exige decisão explícita de implantação e proteção de acesso na infraestrutura. Não expor a interface publicamente sem controle de acesso. A API continua protegida pelas permissões existentes.

Nenhum provedor de hospedagem foi escolhido nesta etapa.
