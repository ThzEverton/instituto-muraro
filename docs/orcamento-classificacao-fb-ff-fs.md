# Orçamento Muraro — organização interna ETH

Classificação informada por Everton em 10/11/2026. Não exibir as siglas no formulário da cliente. Esta organização está na documentação do repositório, não em uma área privada autenticada.

- **FB — Função básica:** cadastros, parâmetros e registros de apoio.
- **FF — Função fundamental:** operações e regras que executam o trabalho da clínica.
- **FS — Função de saída:** relatórios, indicadores, documentos, mensagens e links gerados pelo sistema.

As definições operacionais acima orientam a classificação; um pacote pode conter mais de um tipo. As siglas não indicam prioridade comercial: todos os recursos atuais pertencem ao essencial, inclusive os classificados como FF ou FS.

## Essencial — R$ 6.900 de implementação

Manutenção: R$ 397/mês. Custos externos a definir, sem duplicar a mensalidade ao selecionar adicionais.

| Tipo | Funções incluídas |
|---|---|
| FB | Pacientes e responsáveis; profissionais; serviços; usuários; configurações e modelos de questionários. |
| FF | Agenda e bloqueios; status e faltas; prontuário; avaliações; planos e evoluções; respostas de anamnese; cobranças, recebimentos e estornos; permissões, segurança e recuperação. |
| FS | Painel; relatórios e exportações básicos; links dos formulários e mensagens manuais de WhatsApp. |

Treinamento e preparação para produção também compõem a base. A demo existente não equivale a sistema clínico pronto para produção.

## Adicionais — cobrança única por pacote

| ID | Adicional | FB | FF | FS | Valor |
|---|---|---|---|---|---:|
| agendaextra | Agenda de grupos e sessões automáticas | Capacidade e locais | Regras de vagas e recorrência | Agenda gerada | R$ 650 |
| pilatesextra | Mensalidades e renovação | Parâmetros do plano | Ciclo, duas profissionais e renovação | Aviso/proposta | R$ 550 |
| parcerias | Parcerias e descontos | Tabelas OAB/Marinha | Aplicação das condições | Valor final | R$ 300 |
| whatsapp | Lembretes e confirmação | Modelos e horários | Agendamento do envio e confirmação por link | Mensagem e link | R$ 650 |
| preconsulta | Pré-consulta automática | Modelo por serviço | Disparo na primeira consulta e integração das respostas | Link e pendências destacadas | R$ 450 |
| aniversario | Aniversários e satisfação | Datas e modelo de pesquisa | Disparos programados | Mensagem, pesquisa e respostas | R$ 250 |
| estoque | Estoque e produtos | Produtos, custos, frete e preço | Movimentação e comanda unificada | Alertas e total da comanda | R$ 800 |
| taxas | Parcelas, taxas e comissões | Taxas e percentuais | Parcelamento e cálculo sobre líquido | Fechamento mensal de repasses | R$ 750 |
| caixa | Recorrência e fluxo de caixa | Categorias e periodicidade | Geração das despesas | Projeção de caixa | R$ 400 |
| dre | DRE e custos | Ficha técnica e categorias | Apuração dos custos | DRE gerencial | R$ 650 |
| equilibrio | Margem e ponto de equilíbrio | Premissas e mix | Cálculo da contribuição | Margens e meta de faturamento | R$ 350 |
| balanco | Balanço simplificado | Saldos e classificação | Consolidação | Balanço patrimonial | R$ 600 |
| contratos | Contratos e assinatura externa | Modelos e links externos | Atualização manual e anexos | Contrato e link | R$ 400 |
| fiscal | Organização de notas | Número, data, valor e PDF | Registro manual | Consulta do documento anexado | R$ 150 |

Dependências cobradas uma única vez: pré-consulta e aniversários/pesquisa requerem WhatsApp automático; ponto de equilíbrio requer DRE; DRE requer taxas/comissões; balanço requer fluxo de caixa. O formulário informa essas dependências e inclui seus valores ao marcar o adicional dependente. Ao remover uma dependência, também remove os dependentes.

## Limites comerciais

Valores aplicados por solicitação de Everton após a prévia sugerida, sujeitos ao fechamento de escopo e contrato. Não são estimativa de horas nem compromisso de prazo. Manter os valores sincronizados com public/orcamento.html.

WhatsApp exclusivamente pela API terceirizada de envio da ETH. Sem integração com maquininha, TEF, Smart POS ou APIs oficiais. Taxas e recebimentos informados manualmente. NFS-e emitida externamente; somente registro/anexo no sistema. Assinatura por link externo e status manual. Migração histórica e custos de fornecedores/hospedagem dependem de análise separada.
