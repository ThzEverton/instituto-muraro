# Backend Instituto Muraro

O comando dev inicia src/servidor.ts, API Fastify em português com Prisma/PostgreSQL. Consulte [banco de dados](../docs/BANCO_DE_DADOS.md) para configuração local, migração e criação do administrador; [Swagger](../docs/SWAGGER.md) para documentação da API.

- banco:gerar: gera o cliente Prisma.
- banco:migrar: aplica as migrações versionadas.
- dev / build / start: execução e compilação da API operacional.
- test: validação unitária, documentação e integração PostgreSQL quando TESTAR_POSTGRES=1.

A API demonstrativa antiga em memória e seus três testes históricos foram retirados da árvore ativa. O demo de frontend permanece isolado. Não executar integração com dados reais: use banco descartável. O sistema ainda não está homologado para uso clínico.
