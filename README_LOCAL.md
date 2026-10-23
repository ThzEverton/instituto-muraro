# Instituto Muraro — Desenvolvimento local

Projeto exportado do v0 e aberto no VS Code em 23/10/2026.

## Executar frontend

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev --port 4173
```

Abra: http://127.0.0.1:4173

## Validar

```powershell
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

As mesmas operações estão no VS Code: Terminal > Executar Tarefa.

## Situação

A interface é uma **demonstração com dados fictícios armazenados em memória**. Não há autenticação clínica segura, banco ou API Fastify integrada nesta cópia inicial. Não utilizar com dados reais de saúde. O backend foi solicitado no v0 e precisa ser incorporado e validado separadamente.

A exportação contém Next.js, embora o plano arquitetural original mencionasse React + Vite. Preservar o código existente, sem migração destrutiva.

## Atualizações do v0

Uma nova exportação do v0 pode atualizar os arquivos do frontend. Não substituir `README_LOCAL.md` nem `.vscode` ao sincronizar. Rodar `corepack pnpm install --frozen-lockfile`, `corepack pnpm exec tsc --noEmit` e `corepack pnpm build` novamente após cada atualização.
