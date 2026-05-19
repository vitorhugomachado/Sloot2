const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Corrigindo e Atualizando Função check_disponibilidade ---');

  const sqlCommands = [
    // 1. Drop a função antiga (que retornava BOOLEAN)
    `DROP FUNCTION IF EXISTS check_disponibilidade(bigint, timestamptz, integer);`,

    // 2. Criar a nova versão com retorno JSONB (Riquíssimo em detalhes)
    `CREATE OR REPLACE FUNCTION check_disponibilidade(
      p_barbeiro_id BIGINT,
      p_inicio TIMESTAMPTZ,
      p_duracao_nova_minutos INT
    ) 
    RETURNS JSONB AS $$
    DECLARE
      v_fim_novo TIMESTAMPTZ;
      v_dia_semana INT;
      v_data_pura DATE;
      v_hora_inicio TIME;
      v_hora_fim TIME;
      v_regra RECORD;
      v_existe_conflito BOOLEAN;
      v_is_feriado BOOLEAN;
    BEGIN
      v_fim_novo := p_inicio + (p_duracao_nova_minutos * interval '1 minute');
      v_dia_semana := EXTRACT(DOW FROM p_inicio); 
      v_data_pura := p_inicio::DATE;
      v_hora_inicio := p_inicio::TIME;
      v_hora_fim := v_fim_novo::TIME;

      -- 1. Verifica se é feriado
      SELECT EXISTS (SELECT 1 FROM public.feriados WHERE data = v_data_pura) INTO v_is_feriado;
      IF v_is_feriado THEN
        RETURN jsonb_build_object('disponivel', false, 'motivo', 'Feriado: a barbearia não abrirá nesta data.');
      END IF;

      -- 2. Busca regra do dia da semana
      SELECT * INTO v_regra FROM public.horarios_funcionamento WHERE dia_semana = v_dia_semana;
      
      -- 3. Valida se existe regra para o dia e se está aberto
      IF v_regra IS NULL OR NOT v_regra.is_aberto THEN
        RETURN jsonb_build_object('disponivel', false, 'motivo', 'Barbearia fechada neste dia da semana.');
      END IF;

      -- 4. Valida se o horário está dentro do expediente (Abertura e Fechamento)
      IF v_hora_inicio < v_regra.hora_abertura OR v_hora_fim > v_regra.hora_fechamento THEN
        RETURN jsonb_build_object('disponivel', false, 'motivo', 'Horário fora do expediente (Expediente: ' || v_regra.hora_abertura || ' às ' || v_regra.hora_fechamento || ').');
      END IF;

      -- 5. Valida choque com horário de almoço
      IF (v_hora_inicio >= v_regra.almoco_inicio AND v_hora_inicio < v_regra.almoco_fim) OR
         (v_hora_fim > v_regra.almoco_inicio AND v_hora_fim <= v_regra.almoco_fim) OR
         (v_hora_inicio < v_regra.almoco_inicio AND v_hora_fim > v_regra.almoco_fim) THEN
        RETURN jsonb_build_object('disponivel', false, 'motivo', 'O horário selecionado choca com o intervalo de almoço.');
      END IF;

      -- 6. Verifica sobreposição com outros agendamentos (Overlap)
      SELECT EXISTS (
        SELECT 1 
        FROM public.agendamentos a
        JOIN public."Service" s ON a.id_servico = s.id
        WHERE a.id_barbeiro = p_barbeiro_id
          AND a.deleted_at IS NULL
          AND (a.data_hora_agendamento < v_fim_novo AND (a.data_hora_agendamento + (CAST(substring(s.duration from '^[0-9]+') AS INT) * interval '1 minute')) > p_inicio)
      ) INTO v_existe_conflito;

      IF v_existe_conflito THEN
        RETURN jsonb_build_object('disponivel', false, 'motivo', 'Este profissional já possui um agendamento neste horário.');
      END IF;

      -- TUDO OK!
      RETURN jsonb_build_object('disponivel', true, 'motivo', 'Horário disponível.');
    END;
    $$ LANGUAGE plpgsql;`
  ];

  for (const sql of sqlCommands) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('✅ Comando executado.');
    } catch (err) {
      console.error('❌ Erro:', err.message);
    }
  }

  console.log('--- Função Atualizada! ---');
}

main().finally(async () => await prisma.$disconnect());
