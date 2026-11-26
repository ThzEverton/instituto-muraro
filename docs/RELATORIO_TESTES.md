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

## Cadastros e agenda

- Migração `20261126170245_profissionais_servicos` aplicada somente ao PostgreSQL local isolado.
- Teste de integração validou profissional, serviço, vínculo e controle de acesso; teste unitário rejeitou expediente sobreposto e capacidade inválida.
- Teste de quatro agendamentos simultâneos para capacidade três: três respostas 201 e uma 409, após ajuste de isolamento da transação. O primeiro ensaio falhou com conflitos de serialização e foi corrigido; o ensaio repetido passou.
- Total do último ensaio: 3 arquivos e 12 testes passaram.
- Build do backend e build do Next.js passaram com a nova página de agenda.

Não houve teste visual da interface em navegador nem simulação de operações em múltiplos processos.
