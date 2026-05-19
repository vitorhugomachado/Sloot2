const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Configurando Jornada de Trabalho Avançada ---');

  const sqlCommands = [
    // 1. Tabela de horários de trabalho
    `CREATE TABLE IF NOT EXISTS public.horarios_trabalho (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_barbeiro BIGINT NOT NULL, 
      dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      hora_inicio TIME NOT NULL,
      hora_fim TIME NOT NULL,
      ativo BOOLEAN DEFAULT true,
      CONSTRAINT unique_turno_barbeiro UNIQUE (id_barbeiro, dia_semana, hora_inicio),
      CONSTRAINT fk_barbeiro_horarios FOREIGN KEY (id_barbeiro) REFERENCES public."Barber"(id) ON DELETE CASCADE
    );`,

    // 2. Função de validação de expediente
    `CREATE OR REPLACE FUNCTION is_dentro_expediente(p_barbeiro_id BIGINT, p_data_hora TIMESTAMPTZ)
     RETURNS BOOLEAN AS $$
     BEGIN
       RETURN EXISTS (
         SELECT 1 
         FROM public.horarios_trabalho 
         WHERE id_barbeiro = p_barbeiro_id 
           AND dia_semana = EXTRACT(DOW FROM p_data_hora)
           AND p_data_hora::TIME >= hora_inicio 
           AND p_data_hora::TIME < hora_fim
           AND ativo = true
       );
     END;
     $$ LANGUAGE plpgsql STABLE;`,

    // 3. Trigger para validação atômica no INSERT/UPDATE
    // (PostgreSQL não permite subqueries em CHECK constraints, então usamos triggers)
    `CREATE OR REPLACE FUNCTION public.check_expediente_trigger()
     RETURNS TRIGGER AS $$
     BEGIN
       IF NOT is_dentro_expediente(NEW.id_barbeiro, NEW.data_hora_agendamento) THEN
         RAISE EXCEPTION 'Erro: O profissional selecionado não atende neste dia/horário.';
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,

    `DROP TRIGGER IF EXISTS trg_valida_expediente ON public.agendamentos;`,
    `CREATE TRIGGER trg_valida_expediente
     BEFORE INSERT OR UPDATE ON public.agendamentos
     FOR EACH ROW EXECUTE FUNCTION public.check_expediente_trigger();`
  ];

  for (const sql of sqlCommands) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ Comando executado.');
    } catch (err) {
      console.error('❌ Erro no banco de dados:', err.message);
    }
  }

  console.log('--- Jornada de Trabalho configurada com sucesso! ---');
}

main().finally(async () => await prisma.$disconnect());
