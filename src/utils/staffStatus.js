/** Profissional disponível para agendamento e listagens públicas. */
export function isStaffActive(status) {
  return status === 'Ativo';
}

/** Cores do indicador de status na UI (Ativo = verde; demais = vermelho). */
export function getStaffStatusColors(status) {
  const active = isStaffActive(status);
  return {
    dot: active ? '#16a34a' : '#ef4444',
    text: active ? '#16a34a' : '#ef4444',
  };
}
