# Decisões técnicas

## D01 — Preservar protótipo enquanto a fundação é substituída

As rotas em inglês e `store.ts` continuam identificadas como protótipo. A tradução será feita junto com os contratos do frontend e migrations; uma troca apenas do schema quebraria o sistema sem entregar persistência.

## D02 — Hospedagem independente

Usar PostgreSQL e variáveis de ambiente. Não adotar Oracle Cloud da issue #28 como decisão tomada. Nenhum deploy nesta etapa.

## D03 — PR #34

Não fazer merge automático: contém melhorias pontuais, mas também mantém memória e credenciais demo. Aproveitar validações após revisão individual e tradução dos nomes.
