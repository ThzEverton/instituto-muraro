# Design System — Instituto Muraro

Referência oficial: demo original e identidade visual existente. Aplicação administrativa clínica, não landing page. Preservar marca, estrutura lateral, componentes e densidade de trabalho.

## Tokens

- Fundo: `--m-bg` (#f5f7fb); superfície: `--m-card` (#fff); texto: `--m-text` (#243651); texto secundário: `--m-muted` (#5e7289).
- Navegação e ação principal: `--m-navy` (#142b49); destaque de interação: `--m-blue` (#2c628d).
- Estado: `--ux-erro`, `--ux-sucesso`, `--ux-selecao`, `--ux-link`, `--ux-borda`. Não substituir informação por cor apenas.
- Tipografia: Inter, Segoe UI e Arial como fallback. Texto operacional 13–14px, campos mobile 16px, rótulos auxiliares mínimo 12px. Títulos com hierarquia clara.
- Espaçamento: escala de 4px; cards com respiro de 16–24px; ações mobile de 44px; contraste WCAG AA como piso. Foco visível e navegação por teclado.
- Componentes: `components/physio/ui.tsx`, `app/physio.css`, `app/globals.css` e `app/paciente/paciente.css`. Reutilizar Dialog, Table, Badge, SectionHeader, Metric, SearchFilter e estados vazios.

## Padrões

Listagens em tabelas no desktop e cards no celular. Criação/edição em modais com cabeçalho, campos rotulados, confirmação e cancelamento; manter o estado em caso de erro. Financeiro com abas, indicadores e detalhes sob demanda. Histórico de registros versionados preservado. Navegação coerente com permissões, sem dados de demonstração no fluxo real.

## Evitar

Formulários extensos no meio de listas, cartões decorativos sem função, microtextos, contraste insuficiente, cores arbitrárias em classes, espaçamentos fora da escala, gradientes roxos genéricos, animações lentas, ações não funcionais e uso de cor isoladamente para estados. Não alterar a marca nem introduzir efeitos de marketing. Não inventar números.

## Verificação

Executar `corepack pnpm ux:lint` após alterações de UI; linter original da skill ux-guardrails, sem regras ignoradas. Executar também typecheck, build e testes de navegador relevantes. O lint é uma verificação estática, não certificação WCAG nem validação integral de UX. Manter revisão visual e de interação em desktop/mobile.
