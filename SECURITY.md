# Política de segurança — Instituto Muraro

**NÃO usar o protótipo com dados de saúde reais.**

Informações clínicas são dados pessoais sensíveis na LGPD. Repo privado restrito ao desenvolvimento autorizado. Proibido versionar .env, senhas, chaves, tokens, anexos/atestados reais, bancos ou dumps de pacientes.

Reportar falhas sensíveis em canal privado ao responsável técnico, nunca publicar provas com dados pessoais numa issue ou PR.

Pré-requisitos de produção:
- Sessão segura, proteção de credenciais, HTTPS, validação/rate limiting;
- RBAC e autorização por vínculo profissional/paciente no backend (nem admin acessa prontuário automaticamente);
- registro imutável e adendos auditáveis para evoluções;
- tokens de anamnese expiráveis/revogáveis/uso único, arquivos privados;
- PostgreSQL sem porta pública, backups externos, restore testado;
- revisão da legislação e exigências profissionais de prontuários.
