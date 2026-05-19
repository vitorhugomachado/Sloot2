const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barberIds = [1, 2, 3]; // Carlos, André, Rafael
  const dias = [1, 2, 3, 4, 5, 6];
  
  console.log('--- Populando horários de trabalho para os barbeiros ---');

  for (const bId of barberIds) {
    const payload = [];
    dias.forEach(dia => {
        payload.push({ id_barbeiro: bId, dia_semana: dia, hora_inicio: '09:00', hora_fim: '12:00' });
        payload.push({ id_barbeiro: bId, dia_semana: dia, hora_inicio: '13:00', hora_fim: '19:00' });
    });

    for (const p of payload) {
      const sql = `
        INSERT INTO public.horarios_trabalho (id_barbeiro, dia_semana, hora_inicio, hora_fim)
        VALUES (${p.id_barbeiro}, ${p.dia_semana}, '${p.hora_inicio}', '${p.hora_fim}')
        ON CONFLICT (id_barbeiro, dia_semana, hora_inicio) DO UPDATE SET hora_fim = '${p.hora_fim}';
      `;
      await prisma.$executeRawUnsafe(sql);
    }
    console.log(`✅ Horários inseridos/atualizados para o Barbeiro ID ${bId}`);
  }

  console.log('--- Finalizado! ---');
}

main().finally(() => prisma.$disconnect());
