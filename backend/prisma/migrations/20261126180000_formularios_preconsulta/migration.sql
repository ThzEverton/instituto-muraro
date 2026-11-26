-- AlterTable
ALTER TABLE "modelos_formulario" ADD COLUMN     "modelo_anterior_id" TEXT,
ADD COLUMN     "publicado_em" TIMESTAMP(3),
ADD COLUMN     "revisao" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "servico_id" TEXT;

-- AlterTable
ALTER TABLE "links_formulario" ADD COLUMN     "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paciente_id" TEXT,
ADD COLUMN     "profissional_id" TEXT,
ADD COLUMN     "servico_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "modelos_formulario_modelo_anterior_id_key" ON "modelos_formulario"("modelo_anterior_id");

-- CreateIndex
CREATE INDEX "links_formulario_agendamento_id_modelo_id_idx" ON "links_formulario"("agendamento_id", "modelo_id");

-- CreateIndex
CREATE INDEX "links_formulario_paciente_id_idx" ON "links_formulario"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_formulario_link_id_key" ON "respostas_formulario"("link_id");

-- AddForeignKey
ALTER TABLE "modelos_formulario" ADD CONSTRAINT "modelos_formulario_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_formulario" ADD CONSTRAINT "modelos_formulario_modelo_anterior_id_fkey" FOREIGN KEY ("modelo_anterior_id") REFERENCES "modelos_formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_formulario" ADD CONSTRAINT "links_formulario_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Protege a definicao historica e as respostas originais.
CREATE FUNCTION proteger_modelo_publicado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.situacao = 'PUBLICADO' THEN RAISE EXCEPTION 'Modelo publicado e imutavel'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_modelo_publicado BEFORE UPDATE OR DELETE ON modelos_formulario FOR EACH ROW EXECUTE FUNCTION proteger_modelo_publicado();
CREATE FUNCTION proteger_resposta_formulario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Resposta enviada e imutavel';
END;
$$;
CREATE TRIGGER proteger_resposta_formulario BEFORE UPDATE OR DELETE ON respostas_formulario FOR EACH ROW EXECUTE FUNCTION proteger_resposta_formulario();
