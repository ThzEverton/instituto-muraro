-- CreateEnum
CREATE TYPE "TipoComunicacao" AS ENUM ('CONFIRMACAO_AGENDA', 'LEMBRETE_AGENDA', 'COBRANCA', 'RENOVACAO');

-- CreateEnum
CREATE TYPE "SituacaoComunicacao" AS ENUM ('PENDENTE', 'ENVIADA_MANUALMENTE', 'CANCELADA');

-- AlterTable
ALTER TABLE "pacientes" ADD COLUMN     "autorizado_whatsapp_em" TIMESTAMP(3),
ADD COLUMN     "whatsapp_autorizado" TEXT;

-- CreateTable
CREATE TABLE "regras_comunicacao" (
    "tipo" "TipoComunicacao" NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "antecedencia_dias" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_comunicacao_pkey" PRIMARY KEY ("tipo")
);

-- CreateTable
CREATE TABLE "mensagens_comunicacao" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" "TipoComunicacao" NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "referencia_data" TEXT NOT NULL,
    "situacao" "SituacaoComunicacao" NOT NULL DEFAULT 'PENDENTE',
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviada_em" TIMESTAMP(3),
    "cancelada_em" TIMESTAMP(3),

    CONSTRAINT "mensagens_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_comunicacao_chave_key" ON "mensagens_comunicacao"("chave");

-- CreateIndex
CREATE INDEX "mensagens_comunicacao_situacao_tipo_criada_em_idx" ON "mensagens_comunicacao"("situacao", "tipo", "criada_em");

-- AddForeignKey
ALTER TABLE "mensagens_comunicacao" ADD CONSTRAINT "mensagens_comunicacao_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

