const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Corrigindo Configuração de Status e Cron ---');

  const sqlCommands = [
    // 1. Habilitar pg_cron
    `CREATE EXTENSION IF NOT EXISTS pg_cron;`,

    // 2. Garantir o tipo ENUM
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
         CREATE TYPE booking_status AS ENUM ('Pendente', 'Confirmado', 'Concluido', 'Cancelado', 'No-Show');
       END IF;
     END;
     $$;`,

    // 3. Modificar a coluna de forma segura
    `ALTER TABLE public.agendamentos ALTER COLUMN status DROP DEFAULT;`,
    `ALTER TABLE public.agendamentos 
     ALTER COLUMN status TYPE booking_status 
     USING status::text::booking_status;`,
    `ALTER TABLE public.agendamentos ALTER COLUMN status SET DEFAULT 'Pendente'::booking_status;`,

    // 4. Configurar Cron Job de forma resiliente
    `DO $$
     BEGIN
       -- Tenta desmarcar se já existir
       PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-complete-appointments';
       
       -- Agenda a nova tarefa
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
      console.log('✅ Executado.');
    } catch (err) {
      console.error('❌ Erro no comando:', err.message);
    }
  }

  console.log('--- Sistema de Status e Automação Pronto! ---');
}

main().finally(async () => await prisma.$disconnect());
