-- CreateTable
CREATE TABLE "ausencias_agenda" (
    "id" TEXT NOT NULL,
    "profissional_id" TEXT,
    "data_inicio" VARCHAR(10) NOT NULL,
    "data_fim" VARCHAR(10) NOT NULL,
    "motivo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencias_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ausencias_agenda_profissional_id_data_inicio_data_fim_idx" ON "ausencias_agenda"("profissional_id", "data_inicio", "data_fim");

-- AddForeignKey
ALTER TABLE "ausencias_agenda" ADD CONSTRAINT "ausencias_agenda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

