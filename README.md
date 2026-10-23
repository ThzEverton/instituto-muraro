# Instituto Muraro — Gestão em Fisioterapia

**Projeto privado ETH Tecnologia. Status: protótipo de demonstração, NÃO apto a receber dados reais de pacientes.**

Sistema web sob medida para pacientes, fisioterapeutas (CREFITO), serviços, agenda, bloqueios, avaliações funcionais, planos terapêuticos, evoluções, anamneses e financeiro.

## Tecnologias atuais e pretendidas
- Presente no código: Next.js 16 + React + TypeScript + Tailwind, FullCalendar; backend Fastify em fase experimental, sem PostgreSQL validado.
- Alvo do contrato: Fastify modular MVC/service/repository, Zod, Prisma/PostgreSQL, OpenAPI, Oracle Cloud Compute, PM2, Caddy; sem Docker.
- Os documentos antigos propunham Vite. Não migrar do Next.js sem decisão documentada.

## Rodar localmente
Node.js e pnpm (via Corepack) necessários. No terminal do VS Code:
  corepack pnpm install --frozen-lockfile
  corepack pnpm dev --port 4173

Abra http://localhost:4173. Os cadastros sintéticos são guardados no localStorage e podem ser restaurados nas Configurações.

## Qualidade
  corepack pnpm exec tsc --noEmit
  corepack pnpm build
  corepack pnpm exec tsx scripts/verify-demo.ts
  corepack pnpm --dir backend build
  corepack pnpm --dir backend test

## Estrutura
- app/, components/, lib/: interface, modelos e demo.
- backend/: protótipo de API, **não seguro para dados clínicos reais**.
- docs/CONTEXT.md: escopo vigente, fisioterapia.
- docs/ROADMAP.md: etapas pendentes.
- docs/reference/: documentos originais da pasta Mauro do computador, somente referência histórica interna.
- .github/: CI, modelos de issue, governança.

**Privacidade:** nunca adicionar prontuários, dados pessoais reais, backups, arquivos .env ou tokens neste repositório. Confira SECURITY.md.
