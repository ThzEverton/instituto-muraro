-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMINISTRADOR', 'RECEPCAO', 'FISIOTERAPEUTA');

-- CreateEnum
CREATE TYPE "SituacaoAgendamento" AS ENUM ('AGENDADO', 'AGUARDANDO_CONFIRMACAO', 'CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU');

-- CreateEnum
CREATE TYPE "SituacaoRegistro" AS ENUM ('RASCUNHO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "SituacaoCobranca" AS ENUM ('PENDENTE', 'PARCIAL', 'PAGA', 'VENCIDA', 'CANCELADA', 'ESTORNADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_usuario" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogada_em" TIMESTAMP(3),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "cpf" TEXT,
    "data_nascimento" DATE,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "responsavel_legal" TEXT,
    "contato_emergencia" TEXT,
    "observacoes_administrativas" TEXT,
    "forma_atendimento" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "crefito" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cor_agenda" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "duracao_minutos" INTEGER NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "fim_em" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoAgendamento" NOT NULL DEFAULT 'AGENDADO',

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_agenda" (
    "id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "fim_em" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bloqueios_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_formulario" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "perguntas" JSONB NOT NULL,

    CONSTRAINT "modelos_formulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links_formulario" (
    "id" TEXT NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "agendamento_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),

    CONSTRAINT "links_formulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_formulario" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "enviada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_formulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prontuarios" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "situacao" "SituacaoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prontuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas_prontuario" (
    "id" TEXT NOT NULL,
    "prontuario_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_prontuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "vencimento_em" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoCobranca" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recebimentos" (
    "id" TEXT NOT NULL,
    "cobranca_id" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estornado_em" TIMESTAMP(3),

    CONSTRAINT "recebimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesas" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "ocorrida_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_usuario_token_hash_key" ON "sessoes_usuario"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_usuario_id_expira_em_idx" ON "sessoes_usuario"("usuario_id", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");

-- CreateIndex
CREATE INDEX "pacientes_nome_completo_idx" ON "pacientes"("nome_completo");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_crefito_key" ON "profissionais"("crefito");

-- CreateIndex
CREATE INDEX "agendamentos_profissional_id_inicio_em_fim_em_idx" ON "agendamentos"("profissional_id", "inicio_em", "fim_em");

-- CreateIndex
CREATE INDEX "agendamentos_paciente_id_inicio_em_idx" ON "agendamentos"("paciente_id", "inicio_em");

-- CreateIndex
CREATE INDEX "bloqueios_agenda_profissional_id_inicio_em_fim_em_idx" ON "bloqueios_agenda"("profissional_id", "inicio_em", "fim_em");

-- CreateIndex
CREATE UNIQUE INDEX "links_formulario_token_hash_key" ON "links_formulario"("token_hash");

-- CreateIndex
CREATE INDEX "prontuarios_paciente_id_idx" ON "prontuarios"("paciente_id");

-- CreateIndex
CREATE INDEX "entradas_prontuario_prontuario_id_criada_em_idx" ON "entradas_prontuario"("prontuario_id", "criada_em");

-- CreateIndex
CREATE INDEX "cobrancas_paciente_id_vencimento_em_idx" ON "cobrancas"("paciente_id", "vencimento_em");

-- CreateIndex
CREATE INDEX "recebimentos_cobranca_id_idx" ON "recebimentos"("cobranca_id");

-- CreateIndex
CREATE INDEX "registros_auditoria_entidade_entidade_id_criado_em_idx" ON "registros_auditoria"("entidade", "entidade_id", "criado_em");

-- AddForeignKey
ALTER TABLE "sessoes_usuario" ADD CONSTRAINT "sessoes_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios_agenda" ADD CONSTRAINT "bloqueios_agenda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_formulario" ADD CONSTRAINT "links_formulario_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelos_formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_formulario" ADD CONSTRAINT "respostas_formulario_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links_formulario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prontuarios" ADD CONSTRAINT "prontuarios_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas_prontuario" ADD CONSTRAINT "entradas_prontuario_prontuario_id_fkey" FOREIGN KEY ("prontuario_id") REFERENCES "prontuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos" ADD CONSTRAINT "recebimentos_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
