# Backend Instituto Muraro

O comando `dev` inicia `src/servidor.ts`, API Fastify em português com Prisma/PostgreSQL. Consulte [banco de dados](../docs/BANCO_DE_DADOS.md) para configuração local e migração, e [integrações da API](../docs/INTEGRACOES_API.md) para rotas.

`src/server.ts`, `src/store.ts` e `src/contracts.ts` são remanescentes do protótipo demonstrativo. Seus testes antigos continuam isolados para não apagar evidência histórica, mas essas rotas não são iniciadas pelos scripts `dev` e `start`. Ainda não há integração do frontend nem testes de persistência real.
