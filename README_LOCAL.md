# Instituto Muraro — Desenvolvimento local

O projeto foi exportado do v0 e configurado no VS Code em 23/10/2026.

## Frontend Next.js

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev --port 4173
```
Abra http://127.0.0.1:4173

## API Fastify (implementação demonstrativa)

```powershell
corepack pnpm backend:dev
```
API local: http://localhost:3333/api/v1/health
Documentação: http://localhost:3333/docs

## Testes e build

```powershell
corepack pnpm typecheck
corepack pnpm build
corepack pnpm backend:build
corepack pnpm backend:test
```

## Aviso de segurança e limitações

Esta cópia de desenvolvimento usa dados sintéticos. A interface ainda está desacoplada da API; os dados do frontend estão em memória. O backend original exportado também usa dados em memória e precisa de autenticação, autorização clínica, persistência efetiva no PostgreSQL, políticas LGPD, logs e testes de segurança ANTES de receber dados reais de saúde. O schema Prisma não equivale a banco integrado. Não colocar em produção clínica.

A implementação atual está em Next.js, embora a especificação original tenha mencionado React + Vite. Preservamos o código existente e não fazemos migração destrutiva.

## Atualizações do v0

Ao receber exportação mais recente, sincronizar os arquivos mantendo `.git/`, `.vscode/` e este README, rodar os comandos de validação e registrar novo commit de Git.

## Frontend de fisioterapia — versão revisada (23/10/2026)

A interface foi refeita para o **Instituto Muraro, clínica de fisioterapia**, preservando Next.js e o backend existente.

### Recursos visuais e CRUDs demonstrativos

- Dashboard profissional: programação do dia, pacientes, avaliações, recebimentos e atalhos.
- Pacientes: dados completos de cadastro, busca por nome/telefone, filtros, detalhamento com abas para agenda, avaliação, plano terapêutico, evolução e financeiro; edição e inativação.
- Fisioterapeutas: CREFITO, área de atuação, horários, cor na agenda, edição e inativação.
- Serviços: procedimentos, duração, valor em centavos, categorias, profissionais habilitados e edição.
- Agenda FullCalendar: dia/semana/mês, filtro por fisioterapeuta, drag-and-drop, bloqueios com recorrência em dias úteis, validação de conflito e opções de status.
- Avaliações fisioterapêuticas: queixa, histórico, limitações funcionais, dor EVA e objetivos.
- Planos terapêuticos: metas, frequência e controle de sessões previstas/concluídas.
- Evoluções: procedimentos, dor antes/depois, resposta ao tratamento, orientações, finalização e adendos.
- Financeiro: cobranças, pagamentos parciais, saldo, estornos demonstrativos, despesas e resumo.
- Formulários: editor visual de perguntas e pré-visualização (links seguros externos ainda pendentes).
- Usuários: cadastros e perfis demonstrativos; configurações da clínica e texto para WhatsApp.
- Layout responsivo, sidebar profissional azul-marinho, tabelas com rolagem no celular, formulários mais claros.

### Executar e validar

```powershell
corepack pnpm dev --port 4173
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm exec tsx scripts/verify-demo.ts
```

Abrir `http://127.0.0.1:4173`. Os cadastros da demo são mantidos no **localStorage** do navegador e podem ser restaurados em Configurações.

**Importante:** esta interface NÃO está conectada ao PostgreSQL ou à API clínica de produção. Não use informações identificáveis ou de saúde de pacientes reais, não exponha a demonstração publicamente como prontuário, e não considere os perfis UI como controle de acesso clínico. Integração com Fastify/Prisma, autenticação real, auditoria em servidor, links de anamnese com tokens seguros e validação de conformidade são etapas pendentes.
