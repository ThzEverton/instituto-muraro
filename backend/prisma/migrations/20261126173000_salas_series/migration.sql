-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "sala_id" TEXT,
ADD COLUMN     "serie_id" TEXT;

-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_agendamento" (
    "id" TEXT NOT NULL,
    "intervalo_semanas" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salas_nome_key" ON "salas"("nome");

-- CreateIndex
CREATE INDEX "agendamentos_sala_id_inicio_em_fim_em_idx" ON "agendamentos"("sala_id", "inicio_em", "fim_em");

-- CreateIndex
CREATE INDEX "agendamentos_serie_id_idx" ON "agendamentos"("serie_id");

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "series_agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

