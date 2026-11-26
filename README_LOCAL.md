# Desenvolvimento local — Instituto Muraro

Utilize dados sintéticos exclusivamente. No Windows, abra o projeto no VS Code, instale dependências com 'corepack pnpm install --frozen-lockfile' e execute a tarefa 'Muraro: iniciar local'. Ela inicia o PostgreSQL local, aplica migrações e inicia frontend e backend. As configurações de ambiente reais devem permanecer fora do Git.

## Endereços

- Frontend: http://localhost:4173/sistema
- Demo: http://localhost:4173/demo
- API: http://localhost:3333/api/v1/saude
- Swagger: http://localhost:3333/docs

Para preparação do banco, criação de administrador e execução manual, consulte backend/README.md. Use a mesma configuração de ambiente local do backend. Não execute migrações ou testes contra banco de produção.

## Verificações

corepack pnpm ux:lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm backend:build
corepack pnpm backend:test

Os scripts de navegador verificar-interface-local.mjs e verificar-redesign-local.mjs exigem Chrome e PostgreSQL de desenvolvimento na porta 5433. Eles criam registros sintéticos; não utilizar em produção. Prefira banco descartável para testes. O CI usa banco isolado.

O modo demo permanece separado do sistema operacional. Hospedagem, segurança, privacidade e homologação clínica devem ser concluídas antes do uso real.
