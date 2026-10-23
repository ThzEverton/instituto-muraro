# Instituto Muraro — contexto vigente

Cliente: Instituto Muraro (fisioterapia). Desenvolvedora: ETH Tecnologia. Produto: sistema web personalizado que substituirá o software atual. Demos usam dados sintéticos.

## Requisitos principais
1. Pacientes: cadastro, edição, responsáveis, contatos e histórico.
2. Fisioterapeutas: CREFITO, especialidades, serviços habilitados e expedientes.
3. Agenda por profissional: Dia/Semana/Mês, recorrência semanal, almoço, férias, folgas, cancelamento, reagendamento, confirmação, ausência e conflito transacional.
4. Serviços: duração, preço em centavos, equipe habilitada.
5. Anamnese pré-consulta: editor de perguntas, versões, link individual seguro, expiração, revogação, preenchimento móvel e QR Code.
6. Avaliações fisioterapêuticas: queixa, histórico, EVA, limitações funcionais, achados, objetivos.
7. Planos terapêuticos, sessões, evolução e adendos clínicos auditáveis.
8. Financeiro: cobranças, recebimentos parciais, estornos, despesas e demonstrativos.
9. Papéis ADMIN, RECEPTION e PROFESSIONAL com controle de acesso clínico por vínculo.
10. Dashboard, configurações, auditoria e backup externo.

## Fora da entrega inicial
WhatsApp API automático, NFe, gateway de pagamentos, app móvel nativo, SaaS multi-tenant e migração automática dos dados atuais.

## Documentos originais — uso interno
- reference/escopo-original.txt — contrato/escopo comercial.
- reference/contrato-rest-v1.txt — regras e endpoints.
- reference/prompt-master-fullstack-v4.txt — especificação histórica full-stack.
- reference/tecnologias-planejadas.txt — stack originalmente Vite/Fastify.

**Conflitos conhecidos**: documentos antigos fazem referências a psicologia e Vite; a informação atual validada é FISIOTERAPIA e o frontend implementado usa Next.js. Validar decisões no GitHub por issue e ADR.

## Pronto para produção apenas após
Auth segura, autorização por vínculo, Postgres e migrações, trilhas de auditoria, arquivos privados, backups restauráveis, testes E2E e validação LGPD/requisitos de prontuário de fisioterapia. Os mocks atuais não cumprem isso.
