-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN     "chave_operacao" TEXT,
ADD COLUMN     "contrato_id" TEXT,
ADD COLUMN     "motivo_cancelamento" TEXT,
ADD COLUMN     "parcela" INTEGER;

-- AlterTable
ALTER TABLE "recebimentos" ADD COLUMN     "chave_operacao" TEXT,
ADD COLUMN     "forma_pagamento" TEXT NOT NULL DEFAULT 'OUTRO',
ADD COLUMN     "motivo_estorno" TEXT,
ADD COLUMN     "parcelas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "taxa_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxa_id" TEXT,
ADD COLUMN     "taxa_pontos_base" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "categoria" TEXT NOT NULL DEFAULT 'Geral',
ADD COLUMN     "chave_operacao" TEXT,
ADD COLUMN     "estornada_em" TIMESTAMP(3),
ADD COLUMN     "motivo_estorno" TEXT;

-- CreateTable
CREATE TABLE "parcerias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "desconto_pontos_base" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "parcerias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxas_pagamento" (
    "id" TEXT NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "pontos_base" INTEGER NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxas_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_tratamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "sessoes" INTEGER NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "validade_dias" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "planos_tratamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_plano" (
    "id" TEXT NOT NULL,
    "chave_operacao" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "plano_id" TEXT NOT NULL,
    "parceria_id" TEXT,
    "renovacao_de_id" TEXT,
    "nome_plano" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "sessoes_contratadas" INTEGER NOT NULL,
    "valor_original_centavos" INTEGER NOT NULL,
    "desconto_pontos_base" INTEGER NOT NULL,
    "valor_final_centavos" INTEGER NOT NULL,
    "quantidade_parcelas" INTEGER NOT NULL,
    "inicio_em" DATE NOT NULL,
    "fim_em" DATE NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_sessao" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "agendamento_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes" (
    "id" TEXT NOT NULL,
    "recebimento_id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "pontos_base" INTEGER NOT NULL,
    "base_centavos" INTEGER NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paga_em" TIMESTAMP(3),
    "cancelada_em" TIMESTAMP(3),

    CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_clinica" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_clinica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parcerias_nome_key" ON "parcerias"("nome");

-- CreateIndex
CREATE INDEX "taxas_pagamento_forma_pagamento_parcelas_criada_em_idx" ON "taxas_pagamento"("forma_pagamento", "parcelas", "criada_em");

-- CreateIndex
CREATE UNIQUE INDEX "planos_tratamento_nome_key" ON "planos_tratamento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_plano_chave_operacao_key" ON "contratos_plano"("chave_operacao");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_plano_renovacao_de_id_key" ON "contratos_plano"("renovacao_de_id");

-- CreateIndex
CREATE INDEX "contratos_plano_paciente_id_inicio_em_fim_em_idx" ON "contratos_plano"("paciente_id", "inicio_em", "fim_em");

-- CreateIndex
CREATE UNIQUE INDEX "consumos_sessao_agendamento_id_key" ON "consumos_sessao"("agendamento_id");

-- CreateIndex
CREATE INDEX "consumos_sessao_contrato_id_idx" ON "consumos_sessao"("contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "comissoes_recebimento_id_key" ON "comissoes"("recebimento_id");

-- CreateIndex
CREATE INDEX "comissoes_profissional_id_paga_em_idx" ON "comissoes"("profissional_id", "paga_em");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_chave_operacao_key" ON "cobrancas"("chave_operacao");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_contrato_id_parcela_key" ON "cobrancas"("contrato_id", "parcela");

-- CreateIndex
CREATE UNIQUE INDEX "recebimentos_chave_operacao_key" ON "recebimentos"("chave_operacao");

-- CreateIndex
CREATE UNIQUE INDEX "despesas_chave_operacao_key" ON "despesas"("chave_operacao");

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos_plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_taxa_id_fkey" FOREIGN KEY ("taxa_id") REFERENCES "taxas_pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_tratamento" ADD CONSTRAINT "planos_tratamento_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_plano" ADD CONSTRAINT "contratos_plano_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_plano" ADD CONSTRAINT "contratos_plano_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_tratamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_plano" ADD CONSTRAINT "contratos_plano_parceria_id_fkey" FOREIGN KEY ("parceria_id") REFERENCES "parcerias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_plano" ADD CONSTRAINT "contratos_plano_renovacao_de_id_fkey" FOREIGN KEY ("renovacao_de_id") REFERENCES "contratos_plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_sessao" ADD CONSTRAINT "consumos_sessao_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos_plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_sessao" ADD CONSTRAINT "consumos_sessao_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes" ADD CONSTRAINT "comissoes_recebimento_id_fkey" FOREIGN KEY ("recebimento_id") REFERENCES "recebimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integridade das taxas e dos contratos historicos.
CREATE FUNCTION impedir_alteracao_financeira_historica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro historico imutavel';
END;
$$;
CREATE TRIGGER taxa_pagamento_imutavel BEFORE UPDATE OR DELETE ON taxas_pagamento FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_financeira_historica();
CREATE TRIGGER contrato_plano_imutavel BEFORE UPDATE OR DELETE ON contratos_plano FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_financeira_historica();
CREATE TRIGGER consumo_sessao_imutavel BEFORE UPDATE OR DELETE ON consumos_sessao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_financeira_historica();
ALTER TABLE taxas_pagamento ADD CONSTRAINT taxa_pontos_validos CHECK (pontos_base BETWEEN 0 AND 10000);
ALTER TABLE parcerias ADD CONSTRAINT desconto_pontos_validos CHECK (desconto_pontos_base BETWEEN 0 AND 10000);
ALTER TABLE recebimentos ADD CONSTRAINT taxa_centavos_validos CHECK (taxa_centavos BETWEEN 0 AND valor_centavos AND taxa_pontos_base BETWEEN 0 AND 10000);
ALTER TABLE comissoes ADD CONSTRAINT comissao_valida CHECK (pontos_base BETWEEN 1 AND 10000 AND valor_centavos BETWEEN 1 AND base_centavos AND NOT (paga_em IS NOT NULL AND cancelada_em IS NOT NULL));
