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

## Cadastros e agenda — continuação

Foram implementados os cadastros operacionais de profissionais e serviços, com vínculo persistente, expediente semanal, capacidade, edição/inativação e auditoria. A agenda nova em `/sistema/agenda` usa FullCalendar com visualizações diária, semanal e mensal. O servidor valida expediente, habilitação do serviço, duração, bloqueios, conflitos e capacidade. Gravações do mesmo profissional e dia são serializadas por trava transacional no PostgreSQL.

Ainda faltam bloqueios pela interface, recorrência, locais, feriados, férias, confirmação pública e políticas completas de vínculo clínico. A agenda permanece **parcialmente implementada**. Os cadastros FB02/FB03 também permanecem parciais pelos campos e regras ainda ausentes.

Próxima tarefa de código: completar bloqueios/recorrência/capacidade por local, depois prontuário com vínculo profissional-paciente. A integração do protótipo antigo com as rotas novas continua pendente.

## Bloqueios externos

Conteúdo clínico de fisioterapia pélvica, regras comerciais de desconto/comissão, critérios contábeis e aceite operacional dependem da clínica. Hospedagem e credenciais de integração seguem indefinidas. Trabalho local independente pode continuar.


## Retomada via Desktop Commander — 26/11/2026

Concluídos os bloqueios manuais de um dia por profissional, desbloqueio pela agenda, visualização dos bloqueios, consulta de disponibilidade e contagem de vagas. A API usa a mesma trava transacional dos agendamentos e registra auditoria. Migração conferida no PostgreSQL local isolado (porta 5433). Todos os 13 testes passaram, incluindo bloqueio, recusa de agendamento e liberação de vagas; tipagem e builds passaram. A interface ainda requer homologação visual.

Próximos blocos: recorrência, locais e capacidade por local, feriados/férias; prontuário e autorização por vínculo profissional-paciente. Não há deploy nem alteração de hospedagem.

## Salas e recorrencia

Criados modelos Sala e SerieAgendamento, migracao aditiva e integracao da agenda com cadastro de sala e repeticao de 2 a 52 sessoes em intervalos de 1 a 4 semanas. Criacao de serie em transacao atomica; conflitos de paciente e capacidade da sala validados no servidor. Migracao aplicada somente ao PostgreSQL local de testes. 14 testes passaram, incluindo reversao integral de serie com conflito; builds e tipagem aprovados. Pendentes: edicao/inativacao de salas, cancelamento em lote da serie, feriados/ferias e teste visual.

## Feriados e ferias

AusenciaAgenda implementa periodos inclusivos de ate 91 dias, globais ou por profissional. A agenda exibe o periodo, bloqueia novos atendimentos e disponibilidade, e exige reagendamento/cancelamento de atendimentos existentes antes do fechamento. Criacao e reabertura restritas ao administrador e auditadas. Migracao aplicada no banco sintetico local. 15 testes aprovados, builds e tipagem aprovados. Feriados sao cadastrados manualmente, sem calendario externo. Pendente homologacao visual e restantes funcoes clinicas/financeiras.

## Prontuario clinico - primeira etapa

Implementados VinculoClinico, associacao de usuario a profissional, provisionamento de contas clinicas pelo administrador, autorizacao/revogacao de vinculos, listagem de pacientes autorizados e prontuario com anamnese, avaliacao, evolucao e adendo em texto livre. Rascunhos sao privados do autor; registros finalizados sao visiveis a profissionais autorizados, imutaveis na API e protegidos por trigger PostgreSQL. Auditoria de consultas e alteracoes, controle de versao e tela /sistema/prontuario integrados. Administrador e recepcao nao recebem conteudo clinico. Migracao aditiva aplicada exclusivamente no PostgreSQL local sintetico; 16 testes aprovados, incluindo revogacao, permissao, imutabilidade direta no banco, tipagem e builds. Pendentes: homologacao visual, formularios estruturados e pre-consulta, anexos privados, assinatura digital quando aplicavel, troca obrigatoria de senha inicial, recuperacao de senha, politicas de retencao, revisao LGPD e seguranca de producao. Nao usar dados reais antes da homologacao.
