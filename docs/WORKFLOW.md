# Fluxo Git e PR

- main: branch estável, destinada a versões homologadas; não comitar diretamente.
- develop: integração de features e fixes revisados.
- qa: validação de release com dados sintéticos. Fluxo develop → qa → main.
- feature/<issue>-<slug>, fix/<issue>-<slug>, chore/<slug>: branches curtas abertas de develop.
- hotfix/<issue>-<slug>: criada de main somente para incidente crítico, retornando também para develop.

Para um PR: vincule a issue, descreva critérios de aceite, execute build/typecheck/testes e revise segurança/privacidade. Nenhum PR deve conter pacientes reais ou credenciais.

Habilitar regras de proteção (quando o plano permitir) exigindo PR, revisão, status CI, bloqueio de force push e deleção, para main e develop. Até confirmar na interface GitHub, considerar política recomendada, não enforcement automático.
