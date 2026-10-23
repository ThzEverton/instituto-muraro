# Arquitetura — estado atual e alvo

| Camada | Estado atual | Meta |
| --- | --- | --- |
| UI | Next.js 16 / React / TS, FullCalendar | Frontend modular com TanStack Query e APIs tipadas |
| Dados UI | Fixtures/localStorage | API real; MSW somente demo |
| Backend | Fastify protótipo, rotas de demo | MVC/services/repositories, Zod/OpenAPI, segurança |
| Database | Prisma schema, persistência não homologada | PostgreSQL privado + migrations + transações |
| Infra | VS Code/localhost | Oracle VM Linux, Caddy, PM2, TLS, backup |
| WhatsApp | Manual | wa.me com texto, sem envio por API |

Contrato REST: referência em docs/reference/contrato-rest-v1.txt. Decisão arquitetural em docs/DECISIONS.md.

**Atenção**: React + Vite aparece no escopo original; o frontend existente é Next.js. Não assumir que a migração já ocorreu.
