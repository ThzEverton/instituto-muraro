# Instituto Muraro Backend

API REST v1 em Fastify + TypeScript, com contratos Zod, OpenAPI em `/docs` e adapter em memória para desenvolvimento/testes. O schema Prisma/PostgreSQL está em `prisma/schema.prisma`; nenhum dado real ou credencial é incluído.

## Executar separado

Na raiz: `pnpm install`; backend: `pnpm --dir backend dev`; documentação: `http://localhost:3333/docs`.

## Validar

`pnpm --dir backend build` e `pnpm --dir backend test`.

## Limitações desta rodada

O adapter padrão é in-memory para permitir execução sem PostgreSQL. Para persistência, configure `DATABASE_URL`, gere o Prisma Client e aplique migrações fora deste checkout. Exclusões clínicas são deliberadamente bloqueadas: prontuários finalizados recebem addenda auditável.
