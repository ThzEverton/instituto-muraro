# Arquitetura — MVC horizontal

O Instituto Muraro usa Next.js como View, Fastify como camada HTTP, Prisma/PostgreSQL como Model e uma arquitetura MVC tradicional organizada por responsabilidade. O sistema é um monólito modular em termos de negócio, sem microsserviços; não há pastas verticais por domínio.

    backend/
      prisma/             # modelos e migrações
      src/
        rotas/            # métodos, URLs, middleware e controlador
        controladores/    # adaptadores HTTP
        servicos/         # validação de entrada, regras de negócio e transações
        repositorios/     # acesso tipado às entidades, consultas e travas SQL
        middlewares/      # autenticação, autorização por perfil e erros
        validacoes/       # schemas Zod
        configuracoes/    # Prisma, OpenAPI e Swagger
        tipos/            # DTOs e contexto de identidade
        utilitarios/      # funções de apoio e comandos administrativos
        app.ts            # composição da aplicação
        servidor.ts       # inicialização do servidor
      tests/

Fluxo: rota → middleware → controlador → serviço → repositório → PostgreSQL. A validação de entrada continua nos serviços por compatibilidade com os contratos; os controladores convertem o contexto Fastify em DTO e mapeiam o resultado. Os serviços não importam Fastify nem instanciam o cliente Prisma. Repositórios tipados recebem a conexão/transação atual, sem abrir uma nova transação por consulta. Algumas consultas ainda têm filtros e projeções definidos nos serviços; extraia consultas complexas para operações nomeadas nos repositórios conforme a evolução. O schema Prisma é a fonte única dos modelos, sem duplicação em classes manuais.

API preservada: 82 operações, permissões, transações, locks, auditoria, contratos HTTP e documentação Swagger. Os endpoints públicos de formulário usam Cache-Control: no-store também nos erros de validação. A configuração visual do Swagger já em andamento foi preservada. Não houve migração de schema, alteração de dados existentes ou troca de hospedagem.

## Evolução

- Novos endpoints devem seguir a arquitetura acima e ter cobertura OpenAPI em configuracoes/openapi.ts.
- Não incluir SQL nem instanciar Prisma nos controladores ou serviços.
- Testar regras, contratos, permissões e concorrência em banco descartável.
- Hospedagem definitiva, homologação clínica e segurança operacional continuam pendentes.
