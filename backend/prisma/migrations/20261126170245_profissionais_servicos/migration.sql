-- CreateTable
CREATE TABLE "profissionais_servicos" (
    "profissional_id" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,

    CONSTRAINT "profissionais_servicos_pkey" PRIMARY KEY ("profissional_id","servico_id")
);

-- CreateTable
CREATE TABLE "expedientes_profissional" (
    "id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "inicio_minuto" INTEGER NOT NULL,
    "fim_minuto" INTEGER NOT NULL,

    CONSTRAINT "expedientes_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expedientes_profissional_profissional_id_dia_semana_idx" ON "expedientes_profissional"("profissional_id", "dia_semana");

-- AddForeignKey
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes_profissional" ADD CONSTRAINT "expedientes_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
