# Revisão de UX — Instituto Muraro

Comparação com o demo original em Chrome, desktop 1440×1000 e mobile 390×844. Alterações implementadas sem substituir a identidade visual e sem mudar o backend ou dados clínicos existentes.

## Implementado

- Componentes compartilhados: contraste, tipografia, botões, campos, foco visível, área de toque, cartões responsivos em substituição a tabelas horizontais, feedback e estados vazios.
- Dialog compartilhado: foco inicial, ciclo de Tab, Escape, restauração de foco e bloqueio de rolagem do fundo.
- Login: mostrar/ocultar senha e orientação para contato com administrador (não implementa recuperação automatizada).
- Navegação: sessão centralizada no layout, aria-current, menu mobile com Escape, abas financeiras sincronizadas à URL.
- Dashboard: menor área vazia sem atendimentos e textos mais legíveis.
- Pacientes: paginação do servidor sem contador duplicado; escolha de 10, 20 ou 50 por página; cards no celular.
- Fisioterapeutas e serviços: tabelas responsivas, ações maiores e leitura de nomes compridos.
- Agenda: modo diário em viewport estreita, controles maiores, legenda enxuta, altura limitada e desativação do arraste no celular. Alterações continuam disponíveis pelo formulário. Não alteramos as regras de disponibilidade.
- Financeiro: carregamento por aba, separação catálogo/contratos, formulários de criação recolhíveis, indicadores de caixa, filtros de cobrança sobre página carregada, status, totais de comissões, configurações com hierarquia visual.
- Formulários: busca e filtro de situação; versão identificada com badge.
- Comunicação: fila e regras em abas distintas.
- Prontuário: orientações de seleção e autorização, status de registros, navegação por perfil.
- Pré-consulta: campos, foco e estados de erro melhorados.

## Validação

Typecheck e build Next de produção aprovados. Teste Chrome `scripts/verificar-interface-local.mjs` aprovado usando navegação real pelos links do menu: login, cadastro sintético persistido no PostgreSQL, perfil lateral, oito módulos, abertura do modal no celular, foco e Escape, logout e proteção da API. Auditoria clínica em Chrome com perfis sintéticos de fisioterapeuta e recepção, link de pré-consulta válido, desktop/mobile: concluída sem alertas. Capturas anteriores e posteriores nas pastas externas auditoria-ux-muraro e auditoria-ux-muraro-depois.

A sequência intensiva de recarregamentos completos excedeu o limite global de 100 requisições/minuto no proxy local. A navegação normal do menu passou após as otimizações. Não foi aumentado o limite nem removida a proteção; a configuração por cliente/proxy em produção exige revisão. As capturas administrativas posteriores são de uma revisão intermediária; o teste funcional por menu foi executado na versão final. Os scripts de auditoria visual são utilitários locais com dados sintéticos, não testes de homologação de todas as ações.

## Pendências

Recuperação real de senha, revisão de foco nos modais não compartilhados, filtro global de cobranças no servidor (a busca/status atuais operam na página carregada), revisão detalhada de calendário FullCalendar em múltiplos dispositivos, exportações e homologação integral das regras e fluxos. Não publicar em produção antes da homologação. Não houve push ou deploy.
