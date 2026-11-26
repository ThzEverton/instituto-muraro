# Comunicação e WhatsApp

A página /sistema/comunicacao permite ao administrador habilitar regras de confirmação de agenda, lembrete de atendimento, cobrança a vencer e renovação. Nenhuma regra é habilitada por padrão. A recepção visualiza apenas as mensagens de agenda.

## Fluxo

- Registrar no cadastro do paciente sua autorização de contato no WhatsApp indicado. Alterar o número ou inativar o paciente revoga a autorização.
- Configurar antecedência e mensagem. Variáveis permitidas: {nome}, {data}, {hora}, {clinica}. Evitar informações clínicas e financeiras sensíveis.
- Usar Gerar pendências ou executar o comando `corepack pnpm --dir backend comunicacao:gerar` em ambiente local configurado. A geração é idempotente por evento, tipo e data.
- Preparar uma mensagem valida novamente a autorização e a situação do evento. Conferir texto e destinatário, abrir WhatsApp e enviar manualmente. Registrar envio somente após confirmação do operador.
- O status ENVIADA_MANUALMENTE não constitui confirmação de entrega pelo WhatsApp.

## Implantação futura

O comando de geração pode ser agendado por cron ou pelo serviço de execução selecionado na hospedagem. Ele não envia mensagens. A hospedagem e o provedor de WhatsApp ainda não foram definidos. Integração real de envio, recebimento de respostas, confirmação automática de agenda, reprocessamento e política de retenção são etapas posteriores. Não utilizar dados reais até homologação de privacidade e segurança.
