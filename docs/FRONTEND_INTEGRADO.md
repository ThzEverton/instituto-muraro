# Frontend integrado — Instituto Muraro

A referência visual é o frontend demonstrativo existente no repositório e na Vercel. O painel operacional agora usa a mesma marca, CSS `app/physio.css`, componentes `components/physio/ui.tsx`, menu lateral, cabeçalho, cards, tabelas, modais e perfil lateral.

## Acesso e arquitetura

- `/` direciona ao painel operacional `/sistema`.
- `/sistema` exige sessão real por cookie HttpOnly; o backend continua sendo a autoridade sobre permissões. A recepção não recebe valores financeiros do painel; conteúdo de prontuário permanece restrito ao fisioterapeuta autorizado.
- `/sistema/pacientes`, `/sistema/profissionais`, `/sistema/servicos` e `/sistema/agenda` usam os componentes e padrões originais, ligados ao proxy `/api/sistema`.
- Os módulos de prontuário, financeiro, formulários e comunicação integram a mesma estrutura de navegação e estilos, preservando as funções operacionais já implementadas.
- `/pre-consulta` utiliza a identidade da antiga página de paciente e o token individual real, sem respostas fictícias.
- `/demo` mantém a demonstração isolada em desenvolvimento. Para uma implantação explicitamente demonstrativa, definir `MURARO_MODO_DEMO=true` durante o build; sem essa opção o modo demo e a antiga página simulada são indisponíveis em produção.
- Nenhum dado do localStorage demonstrativo é importado ou gravado no PostgreSQL. O código do demo foi preservado em `components/physio/demonstracao.tsx`. A camada `lib/mock-api.ts` continua apenas ligada aos mocks legados, não ao painel real.
- Em produção, configurar a origem HTTPS pública em `ORIGEM_APLICACAO` se necessário para o proxy reverso, e `API_INTERNA_URL` para o backend. Nenhum provedor de hospedagem foi escolhido.

## Validação

- Backend e frontend compilados, 22 testes automatizados com PostgreSQL local aprovados, incluindo permissões do novo endpoint de indicadores.
- `scripts/verificar-interface-local.mjs` executa Chrome headless em perfil temporário, apenas no banco local de desenvolvimento. Cria dados sintéticos e inativa os registros de teste ao terminar.
- Verificado login real, ausência de dados demo no localStorage operacional, cadastro pelo modal persistido no banco, perfil lateral, abertura dos módulos, navegação por abas do financeiro, logout e bloqueio do endpoint após logout.
- Validação de origem aceita localhost e 127.0.0.1 em desenvolvimento conforme o Host e recusa origem externa. A produção exige origem HTTPS quando não configurada explicitamente.

## Pendências

A identidade e estrutura originais foram reaproveitadas, mas ainda é necessário homologar cada fluxo, comparar telas em diferentes tamanhos e revisar os detalhes dos módulos novos. O perfil lateral é administrativo; informações clínicas não são expostas a administradores ou recepção. O plano terapêutico clínico estruturado da demo não equivale ao pacote financeiro e não deve ser apresentado como já implementado. Exportações completas e revisão clínica permanecem pendentes. Não foi realizado push/deploy.
