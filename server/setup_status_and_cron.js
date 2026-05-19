const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Configurando Status ENUM e Automação Cron ---');

  const sqlCommands = [
    // 1. Habilitar extensões necessárias
    `CREATE EXTENSION IF NOT EXISTS pg_cron;`,

    // 2. Criar ENUM de Status (com IF NOT EXISTS via do block)
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
         CREATE TYPE booking_status AS ENUM ('Pendente', 'Confirmado', 'Concluido', 'Cancelado', 'No-Show');
       END IF;
     END;
     $$;`,

    // 3. Modificar coluna status na tabela agendamentos
    // Nota: Primeiro removemos o check constraint antigo se existir
    `ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;`,
    `ALTER TABLE public.agendamentos 
     ALTER COLUMN status TYPE booking_status 
     USING status::text::booking_status;`,
    `ALTER TABLE public.agendamentos ALTER COLUMN status SET DEFAULT 'Pendente';`,

    // 4. Criar a tarefa agendada (Cron Job)
    // Roda a cada 30 minutos: '*/30 * * * *'
    // Muda Confirmado -> Concluido se passou 2 horas do início
    `SELECT cron.unschedule('auto-complete-appointments');`,
    `SELECT cron.schedule(
      'auto-complete-appointments',
      '*/30 * * * *',
      $$ 
        UPDATE public.agendamentos 
        SET status = 'Concluido' 
        WHERE status = 'Confirmado' 
        AND data_hora_agendamento < (now() - interval '2 hours')
      $$
    );`
  ];

  for (const sql of sqlCommands) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ Comando executado.');
    } catch (err) {
      // Ignorar erro de unschedule se a tarefa não existir
      if (!err.message.includes('not found')) {
        console.error('❌ Erro:', err.message);
      } else {
        console.log('ℹ️ Nenhuma tarefa anterior para limpar, prosseguindo...');
      }
    }
  }

  console.log('--- Configuração Concluída! ---');
}

main().finally(async () => await prisma.$disconnect());
