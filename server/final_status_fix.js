const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Resiliente: Atualizando Status com View Dependente ---');

  const sqlCommands = [
    // 1. Drop a View Temporariamente
    `DROP VIEW IF EXISTS public.v_agendamentos_ativos;`,

    // 2. Modificar a Coluna para ENUM
    `ALTER TABLE public.agendamentos ALTER COLUMN status DROP DEFAULT;`,
    `ALTER TABLE public.agendamentos 
     ALTER COLUMN status TYPE booking_status 
     USING status::text::booking_status;`,
    `ALTER TABLE public.agendamentos ALTER COLUMN status SET DEFAULT 'Pendente'::booking_status;`,

    // 3. Recriar a View
    `CREATE OR REPLACE VIEW public.v_agendamentos_ativos AS
     SELECT id, id_cliente, id_barbeiro, id_servico, data_hora_agendamento, valor, status
     FROM public.agendamentos
     WHERE deleted_at IS NULL;`,

    // 4. Garantir Cron Job
    `DO $$
     BEGIN
       PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-complete-appointments';
       PERFORM cron.schedule(
         'auto-complete-appointments',
         '*/30 * * * *',
         'UPDATE public.agendamentos SET status = ''Concluido''::booking_status WHERE status = ''Confirmado''::booking_status AND data_hora_agendamento < (now() - interval ''2 hours'')'
       );
     END;
     $$;`
  ];

  for (const sql of sqlCommands) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ OK.');
    } catch (err) {
      console.error('❌ Erro:', err.message);
    }
  }

  console.log('--- Sucesso Total! ---');
}

main().finally(async () => await prisma.$disconnect());
