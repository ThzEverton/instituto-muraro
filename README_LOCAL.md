# Instituto Muraro — Desenvolvimento local

O projeto foi exportado do v0 e configurado no VS Code em 23/10/2026.

## Frontend Next.js

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev --port 4173
```
Abra http://127.0.0.1:4173

## API Fastify (implementação demonstrativa)

```powershell
corepack pnpm backend:dev
```
API local: http://localhost:3333/api/v1/health
Documentação: http://localhost:3333/docs

## Testes e build

```powershell
corepack pnpm typecheck
corepack pnpm build
corepack pnpm backend:build
corepack pnpm backend:test
```

## Aviso de segurança e limitações

Esta cópia de desenvolvimento usa dados sintéticos. A interface ainda está desacoplada da API; os dados do frontend estão em memória. O backend original exportado também usa dados em memória e precisa de autenticação, autorização clínica, persistência efetiva no PostgreSQL, políticas LGPD, logs e testes de segurança ANTES de receber dados reais de saúde. O schema Prisma não equivale a banco integrado. Não colocar em produção clínica.

A implementação atual está em Next.js, embora a especificação original tenha mencionado React + Vite. Preservamos o código existente e não fazemos migração destrutiva.

## Atualizações do v0

Ao receber exportação mais recente, sincronizar os arquivos mantendo `.git/`, `.vscode/` e este README, rodar os comandos de validação e registrar novo commit de Git.
