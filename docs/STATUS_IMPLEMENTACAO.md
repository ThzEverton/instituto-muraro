# Estado da implementação — 26/11/2026

## Auditoria

Branch de trabalho: `feature/fundacao-portugues-auditoria`, criada de `develop` (`8bb0aa1`). `main`, `qa` e `feature/backend-prisma-foundation` existem localmente e no remoto. A PR [#34](https://github.com/ThzEverton/instituto-muraro/pull/34) segue aberta em rascunho contra `develop`; seu próprio texto declara falta de banco real, RBAC e backups. Não houve merge.

Frontend Next.js demonstrativo: `app/page.tsx` grava dados em `localStorage`; `lib/mock-api.ts` ainda faz parte do protótipo. Backend Fastify: `backend/src/store.ts` contém arrays em memória; `/api/v1/auth/login` devolve token demonstrativo. `backend/prisma/schema.prisma` usa identificadores ingleses e não é usado pelas rotas. Não há migrations versionadas. O CI compila e testa o protótipo, mas não comprova persistência nem segurança clínica.

O [repositório](https://github.com/ThzEverton/instituto-muraro) está **público** apesar da descrição de sistema privado. Recomenda-se torná-lo privado após autorização do responsável; a visibilidade não foi alterada.

Foi adicionado bloqueio de inicialização do backend demonstrativo em `NODE_ENV=production`. Isto impede exposição acidental do login demo enquanto a fundação real é desenvolvida; não substitui a autenticação nem a persistência.

O script `backend start` apontava para `dist/server.js`, mas o build emite `dist/src/server.js`; o caminho foi corrigido.

## Progresso verificável

| Grupo | Desenvolvimento concluído | Testes completos | Homologação |
| --- | ---: | ---: | ---: |
| FB (7 funções) | 0/7 | 0/7 | 0/7 |
| FF (6 funções) | 0/6 | 0/6 | 0/6 |
| FS (2 funções) | 0/2 | 0/2 | 0/2 |

Há telas e rotas parciais, registradas na matriz. Nenhuma cumpre todos os critérios de conclusão do briefing.

## Próxima tarefa técnica

Concluir a tradução controlada de contratos e schema, criar migração PostgreSQL inicial não destrutiva, conectar repositórios Prisma, implementar autenticação e sessões persistentes, depois integrar o frontend. Os critérios de #2, #3, #4, #5, #22, #23 e #33 têm prioridade. Não usar a PR #34 como fundação pronta.

## Continuação da fundação nesta sessão

Foi criado o servidor novo em `backend/src/servidor.ts`, que substitui o servidor demo nos scripts. O schema e a migração inicial usam nomes de domínio em português. Autenticação com senha scrypt, sessão persistida com token em hash, expiração, logout e perfis no servidor foi implementada para as rotas novas. O cadastro, consulta, busca, edição e inativação de pacientes usam Prisma e auditoria em transação. O Next.js ganhou `/sistema` e um proxy com cookie HttpOnly para esse fluxo. A tela demonstrativa antiga permanece isolada e ainda não foi refatorada.

A migração inicial foi aplicada **somente** ao PostgreSQL sintético isolado em Docker na porta 5433. O teste de integração com banco passou, mas a interface ainda não passou por teste de navegador. Nenhuma função FB foi marcada como concluída, porque as demais partes do escopo e a integração global ainda faltam.

Próxima tarefa: completar responsáveis e histórico de paciente; vincular profissionais e serviços; implementar recuperação de senha, acesso clínico por vínculo e proteção de anexos. Depois migrar as demais telas do protótipo para a API.

## Bloqueios externos

Conteúdo clínico de fisioterapia pélvica, regras comerciais de desconto/comissão, critérios contábeis e aceite operacional dependem da clínica. Hospedagem e credenciais de integração seguem indefinidas. Trabalho local independente pode continuar.
