# Matriz do escopo contratado

Status: **parcialmente implementada** significa somente protótipo ou parte do fluxo; nenhuma linha está testada ou homologada de ponta a ponta. Prioridade P0/P1. Critério comum de aceite: interface, backend, PostgreSQL, autorização, validação, erros, integração, testes e documentação em português.

| Código | Classe | Módulo / descrição | Prioridade | Status | Dependência | Arquivos atuais | Issue | Testes atuais | Critério adicional / bloqueio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FB01 | FB | Pacientes e responsáveis | P1 | Parcialmente implementada | Fundação | `app/page.tsx`, `backend/src/server.ts` | #10 | Demo básico | Duplicidade, vínculos e histórico preservado |
| FB02 | FB | Profissionais | P1 | Parcialmente implementada | Fundação | `app/page.tsx`, `backend/src/server.ts` | #11 | Nenhum completo | CREFITO e expediente |
| FB03 | FB | Serviços e procedimentos | P1 | Parcialmente implementada | Fundação | `app/page.tsx`, `backend/src/server.ts` | #12 | Nenhum completo | Capacidade e custos |
| FB04 | FB | Usuários, autenticação e permissões | P0 | Parcialmente implementada | Banco | `backend/src/server.ts`, `backend/prisma/schema.prisma` | #2, #3, #21 | Nenhum real | Login/sessões e RBAC persistentes; demo proibida |
| FB05 | FB | Parcerias e descontos | P1 | Em desenvolvimento | FB01, FB03 | `app/page.tsx` | Lacuna a revisar | Nenhum | Percentuais dependem da clínica |
| FB06 | FB | Taxas de pagamento | P1 | Em desenvolvimento | FB03 | `app/page.tsx` | Lacuna a revisar | Nenhum | Histórico de taxas imutável |
| FB07 | FB | Configurações da clínica | P1 | Em desenvolvimento | Fundação | `app/page.tsx` | #21 | Nenhum | Persistência e permissões |
| FF01 | FF | Agenda completa | P1 | Parcialmente implementada | FB01–FB03 | `app/page.tsx`, `backend/src/server.ts` | #13–#15 | Conflito demo | Recorrência, capacidade e concorrência reais |
| FF02 | FF | Prontuário clínico | P0 | Parcialmente implementada | FB04 | `backend/src/server.ts` | #3, #5, #7, #17, #18 | Nenhum real | Vínculo, integridade e anexos privados |
| FF03 | FF | Formulários e pré-consulta | P1 | Parcialmente implementada | FF01, FF02 | `app/paciente/page.tsx`, `backend/src/server.ts` | #6, #16 | Nenhum real | Versões, respostas e tokens persistentes; conteúdo clínico a validar |
| FF04 | FF | Planos, mensalidades e renovação | P1 | Em desenvolvimento | FF01, FF05 | `app/page.tsx` | Lacuna a revisar | Nenhum | Autorização de renovação e idempotência |
| FF05 | FF | Financeiro e comissões | P1 | Parcialmente implementada | FB05, FB06 | `app/page.tsx`, `backend/src/server.ts` | #19, #20 | Nenhum real | Saldos, estornos e repasses auditáveis; regras a validar |
| FF06 | FF | Migração e implantação assistida | P1 | Não iniciada | Demais FF | `docs/ROADMAP.md` | #32 | Nenhum | Migração controlada; hospedagem indefinida |
| FS01 | FS | WhatsApp e automações | P1 | Parcialmente implementada | FF01, FF03, FF04 | `app/page.tsx` | Lacuna a revisar | Nenhum | Escopo contratado sem API oficial; canal/provedor a definir |
| FS02 | FS | Painel e relatórios | P1 | Parcialmente implementada | FF05 | `app/page.tsx` | #24 | Nenhum real | Totais reconciliados e critérios contábeis validados |

## Desenvolvimento, testes e homologação

Contagem por funcionalidade concluída: **0/15** em desenvolvimento, **0/15** em testes completos e **0/15** em homologação. FB **0/7**, FF **0/6**, FS **0/2**. Os testes demo existentes não satisfazem os critérios completos.
