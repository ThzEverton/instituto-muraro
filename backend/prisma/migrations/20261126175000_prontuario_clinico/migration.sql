-- CreateEnum
CREATE TYPE "TipoEntradaClinica" AS ENUM ('ANAMNESE', 'AVALIACAO', 'EVOLUCAO', 'ADENDO');

-- AlterTable
ALTER TABLE "profissionais" ADD COLUMN     "usuario_id" TEXT;

-- AlterTable
ALTER TABLE "entradas_prontuario" ADD COLUMN     "autor_nome" TEXT,
ADD COLUMN     "autor_registro" TEXT,
ADD COLUMN     "finalizada_em" TIMESTAMP(3),
ADD COLUMN     "situacao" "SituacaoRegistro" NOT NULL DEFAULT 'RASCUNHO',
ADD COLUMN     "tipo" "TipoEntradaClinica" NOT NULL DEFAULT 'EVOLUCAO',
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "vinculos_clinicos" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculos_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vinculos_clinicos_profissional_id_ativo_idx" ON "vinculos_clinicos"("profissional_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_clinicos_paciente_id_profissional_id_key" ON "vinculos_clinicos"("paciente_id", "profissional_id");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_usuario_id_key" ON "profissionais"("usuario_id");

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos_clinicos" ADD CONSTRAINT "vinculos_clinicos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos_clinicos" ADD CONSTRAINT "vinculos_clinicos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve finalized clinical records even outside the API.
CREATE FUNCTION proteger_entrada_clinica_finalizada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.situacao = 'FINALIZADO' THEN
    RAISE EXCEPTION 'Registro clinico finalizado nao pode ser alterado ou excluido';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_entrada_clinica_finalizada BEFORE UPDATE OR DELETE ON entradas_prontuario FOR EACH ROW EXECUTE FUNCTION proteger_entrada_clinica_finalizada();
ALTER TABLE entradas_prontuario ADD CONSTRAINT entrada_clinica_finalizacao_coerente CHECK ((situacao = 'FINALIZADO') = (finalizada_em IS NOT NULL));
