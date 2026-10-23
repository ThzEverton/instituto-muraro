# Roadmap — plano de desenvolvimento

A fonte operacional é o backlog de GitHub Issues. Este arquivo documenta as frentes e prioridades.

**P0 Segurança/produção**: autenticação sem perfil arbitrário, papéis + escopo clínico, Prisma/PostgreSQL reais, transações, auditoria, anexos privados, backup/restauração, LGPD/prontuário.

**P1 Operação clínica**: CRUD pacientes, fisioterapeutas e serviços; agenda FullCalendar integrada à API (almoço recorrente, férias, conflitos, reagendamento); formulários versionados com token/QR e respostas; avaliação/EVA, planos, sessões e evoluções; financeiro consistente; usuários.

**P2 Qualidade**: organização modular do frontend, decisões Next/Vite, design responsivo, acessibilidade, performance, documentação, automação, QA.

## Fases
- F0: repositório privado, branches main/develop/qa, templates de PR, CI e backlog.
- F1: backend seguro e modelo de dados; nunca colocar dado real durante a fase.
- F2: integrar operação/agenda + prontuários.
- F3: financeiro, administração e configurações.
- F4: testes de ponta a ponta, homologação com dados sintéticos, hardening de segurança.
- F5: deploy Oracle Cloud, PM2/Caddy/TLS, backups, monitoramento, treinamento e aceite.

**Situação atual**: a interface é demonstrativa; os fluxos de banco/segurança/produção estão pendentes, independentemente de componentes visuais prontos.
