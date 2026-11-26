# Instituto Muraro — regras permanentes

- Idioma de domínio, API, banco, testes, documentação e mensagens: português do Brasil. Identificadores sem acentos; convenções PascalCase, camelCase, snake_case no banco e kebab-case em rotas/arquivos.
- Escopo contratado: FB01–FB07, FF01–FF06 e FS01–FS02, conforme `docs/MATRIZ_ESCOPO.md`. Não implementar os módulos excluídos do orçamento de R$ 6.750,00.
- Preservar Next.js, React, Fastify, Prisma e componentes existentes. Evoluir incrementalmente; não reescrever o produto.
- Hospedagem indefinida. PostgreSQL padrão e configuração por variáveis de ambiente. Não depender de fornecedor específico nem fazer deploy sem autorização.
- Dados clínicos exigem autenticação real, autorização no servidor por perfil e vínculo, auditoria, validação e armazenamento privado. Nunca usar dados reais em desenvolvimento nem credenciais demo em produção.
- `localStorage` do demo é protótipo, não persistência. A API antiga em memória foi removida. Não marcar funcionalidades como implementadas até validar interface, backend, banco, permissões, erros e testes.
- Preservar histórico financeiro e clínico. Não executar migração destrutiva sem análise de dados e plano de reversão.
- Trabalhar em `feature/*` ou `fix/*`, integrar em `develop`, homologar em `qa` e preservar `main`. PRs e commits em português. Não fazer push direto na `main`.
- Atualizar `docs/STATUS_IMPLEMENTACAO.md`, `docs/MATRIZ_ESCOPO.md`, `docs/BACKLOG.md` e `docs/RELATORIO_TESTES.md` ao encerrar cada etapa. Registrar resultados observados, não presumidos.

## Arquitetura obrigatória

- O backend segue MVC horizontal: rotas, controladores, servicos, repositorios, middlewares, validacoes, configuracoes, tipos e utilitarios. Não recriar pastas verticais de módulos.
- Prisma schema é o Model; Next.js é a View; controladores Fastify adaptam HTTP. Serviços concentram regras e recebem DTOs; repositórios executam o acesso ao banco e SQL. Não duplicar modelos nem introduzir microsserviços.
- Preserve transações, locks, autorização clínica e auditoria. Teste a separação das camadas em backend/tests/arquitetura.test.ts.
- Consulte docs/ARCHITECTURE.md antes de modificar o backend.
