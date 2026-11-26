# Banco de dados

O schema em `backend/prisma/schema.prisma` usa nomes de domínio em português, tabelas e colunas físicas em `snake_case`. A migração `20261126000000_fundacao_portugues` é inicial, gerada a partir de banco vazio. **Não aplicar em banco que já contenha dados sem análise e backup.**

## Desenvolvimento local

PostgreSQL 16 pode ser iniciado com `docker compose -f compose.local.yaml up -d` se o Docker estiver ativo. O Compose usa a porta local **5433**. É opcional: qualquer PostgreSQL padrão com `DATABASE_URL` funciona. A senha do Compose é apenas de desenvolvimento e deve ser alterada fora desse ambiente.

1. Definir `DATABASE_URL` conforme `backend/.env.example`.
2. Executar `corepack pnpm --dir backend banco:gerar`.
3. Em banco vazio, executar `corepack pnpm --dir backend banco:migrar`.
4. Criar administrador: definir `ADMIN_EMAIL` e enviar a senha pela entrada padrão a `corepack pnpm --dir backend administrador:criar`; nunca gravar a senha no repositório.
5. Executar `corepack pnpm --dir backend dev`.

O serviço responde em `/api/v1/saude` com 200 apenas se o banco estiver acessível. Backup, restauração e migração do sistema anterior ainda não foram validados.

## Mapeamento controlado do protótipo

| Protótipo | Domínio novo |
| --- | --- |
| User / Role | Usuario / PerfilUsuario |
| Patient | Paciente |
| Professional | Profissional |
| Service | Servico |
| Appointment | Agendamento |
| CalendarBlock | BloqueioAgenda |
| AnamnesisTemplate / Link / Response | ModeloFormulario / LinkFormulario / RespostaFormulario |
| MedicalRecord / RecordEntry | Prontuario / EntradaProntuario |
| Charge / Payment / Expense | Cobranca / Recebimento / Despesa |
| AuditLog | RegistroAuditoria |

Os dados do protótipo ficam em memória ou `localStorage`, não em tabelas persistentes. O mapeamento não implica migração automática de dados clínicos.
