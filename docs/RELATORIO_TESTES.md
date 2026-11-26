# Relatório de testes

Data: 26/11/2026. O teste existente `backend/tests/api.test.ts` cobre health, cadastro/inativação em memória e conflito de agenda em memória. Ele não comprova banco, autenticação, permissões, concorrência, restauração ou integração entre navegadores. Resultados da execução desta etapa devem ser registrados abaixo após execução; não inferir aprovação a partir do CI histórico.

## Execução local desta etapa

- `corepack pnpm --dir backend test`: 1 arquivo, 3 testes aprovados.
- `corepack pnpm --dir backend build`: aprovado.
- `NODE_ENV=production node backend/dist/src/server.js`: processo recusou inicialização com código 1 e mensagem explícita de bloqueio do backend demonstrativo.
- `git diff --check`: sem erros de whitespace.

Não foram executados testes com PostgreSQL, Playwright, restauração ou operação concorrente. O frontend não foi testado nesta etapa.
