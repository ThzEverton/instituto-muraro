# API em português

O servidor novo está em `backend/src/servidor.ts` e usa Prisma/PostgreSQL. Rotas disponíveis nesta etapa:

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/v1/saude` | Público, verifica banco |
| POST | `/api/v1/autenticacao/entrar` | Público, limite de 5 tentativas/minuto |
| POST | `/api/v1/autenticacao/sair` | Sessão válida |
| GET | `/api/v1/pacientes` | Administração/recepção |
| POST | `/api/v1/pacientes` | Administração/recepção |
| GET | `/api/v1/pacientes/:id` | Administração/recepção |
| PATCH | `/api/v1/pacientes/:id` | Administração/recepção |
| GET/POST | `/api/v1/profissionais` | Administração/recepção |
| GET/PATCH | `/api/v1/profissionais/:id` | Administração/recepção |
| GET | `/api/v1/servicos` | Usuário autenticado |
| POST | `/api/v1/servicos` | Administração/recepção |
| GET | `/api/v1/servicos/:id` | Usuário autenticado |
| PATCH | `/api/v1/servicos/:id` | Administração/recepção |
| GET/POST | `/api/v1/agendamentos` | Administração/recepção |
| PATCH | `/api/v1/agendamentos/:id` | Administração/recepção |

Sessões são persistidas com hash SHA-256 do token e expiram após oito horas. Senhas são derivadas com scrypt e sal aleatório. A API usa `Authorization: Bearer <token>`, configura CORS por `CORS_ORIGIN` e retorna mensagens de erro sem dados clínicos. O frontend operacional consome esta API pelo proxy `/api/sistema`; a demonstração permanece isolada.

As rotas antigas em inglês foram retiradas da árvore de trabalho e permanecem no histórico Git. Consulte o Swagger para o contrato vigente.
