# Instituto Muraro — Gestão em Fisioterapia

Sistema operacional em desenvolvimento, com frontend integrado e PostgreSQL. **Não homologado para uso com dados reais de saúde.** O repositório não deve conter dados pessoais, prontuários, backups ou credenciais.

## Stack

Next.js, React, TypeScript, Tailwind CSS, FullCalendar, Fastify, Zod, Prisma e PostgreSQL. Hospedagem definitiva ainda não decidida.

## Executar localmente

Pré-requisitos: Node.js 24, Corepack/pnpm e Docker para o PostgreSQL de desenvolvimento. Instale as dependências:

    corepack pnpm install --frozen-lockfile

No VS Code, execute a tarefa **Muraro: iniciar local** (Windows/PowerShell). Para configuração manual, consulte [backend/README.md](backend/README.md) e [README_LOCAL.md](README_LOCAL.md).

- Sistema: http://localhost:4173/sistema
- Demonstração isolada: http://localhost:4173/demo
- Swagger: http://localhost:3333/docs
- Saúde: http://localhost:3333/api/v1/saude

Crie o administrador local conforme o README do backend. Não reutilize credenciais de teste em produção.

## Funcionalidades

Autenticação e perfis, pacientes, profissionais, serviços, agenda, recorrências, bloqueios, prontuário com controle por vínculo, pré-consulta e formulários versionados, planos, cobranças, despesas, comissões e fila de comunicação manual. Integração WhatsApp de envio automático e homologação clínica permanecem pendentes. Ver matriz de escopo para limites específicos.

## Qualidade

    corepack pnpm ux:lint
    corepack pnpm typecheck
    corepack pnpm build
    corepack pnpm backend:build
    corepack pnpm backend:test

Testes de integração PostgreSQL usam TESTAR_POSTGRES=1 em banco exclusivamente sintético. CI executa migrações em banco descartável. Consulte [docs/RELATORIO_TESTES.md](docs/RELATORIO_TESTES.md).

## Documentação

- [Matriz de escopo](docs/MATRIZ_ESCOPO.md) e [status](docs/STATUS_IMPLEMENTACAO.md)
- [Backlog](docs/BACKLOG.md) e [decisões técnicas](docs/DECISOES_TECNICAS.md)
- [Banco](docs/BANCO_DE_DADOS.md) e [Swagger](docs/SWAGGER.md)
- [Frontend integrado](docs/FRONTEND_INTEGRADO.md), [design system](DESIGN.md) e [revisão UX](docs/REVISAO_UX.md)
- [Fluxo Git](docs/WORKFLOW.md) e [segurança](SECURITY.md)

Fluxo: feature → develop → qa → main. O deploy do ambiente demonstrativo é independente da homologação do sistema operacional.
