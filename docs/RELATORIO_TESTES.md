# Relatório de testes

Data: 26/11/2026. O teste existente `backend/tests/api.test.ts` cobre health, cadastro/inativação em memória e conflito de agenda em memória. Ele não comprova banco, autenticação, permissões, concorrência, restauração ou integração entre navegadores. Resultados da execução desta etapa devem ser registrados abaixo após execução; não inferir aprovação a partir do CI histórico.

## Execução local desta etapa

- `corepack pnpm --dir backend test`: 1 arquivo, 3 testes aprovados.
- `corepack pnpm --dir backend build`: aprovado.
- `NODE_ENV=production node backend/dist/src/server.js`: processo recusou inicialização com código 1 e mensagem explícita de bloqueio do backend demonstrativo.
- `git diff --check`: sem erros de whitespace.

Não foram executados testes com PostgreSQL, Playwright, restauração ou operação concorrente. O frontend não foi testado nesta etapa.

## Continuação com código novo

- `prisma validate`: schema válido.
- `prisma migrate deploy`: migração inicial aplicada ao PostgreSQL isolado na porta 5433.
- `corepack pnpm --dir backend test` com `TESTAR_POSTGRES=1`: 3 arquivos e 9 testes passaram; inclui login, acesso negado por perfil, cadastro persistido, inativação e logout.
- `corepack pnpm --dir backend build`: passou.
- `corepack pnpm typecheck`: passou.
- `corepack pnpm build`: passou após atualizar Next.js de 16.4.3 para 16.4.6. A versão antiga interrompia o build com aviso de vulnerabilidade.

Não houve teste de navegador nem restauração de backup. O PostgreSQL utilizado contém somente dados sintéticos criados pelos testes.
