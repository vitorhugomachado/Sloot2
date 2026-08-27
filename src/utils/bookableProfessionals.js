export function isBookableProfessional(professional) {
  if (!professional) return false;
  if (professional.status !== 'Ativo') return false;
  if (professional.acceptsAppointments === false) return false;
  return professional.role === 'Barbeiro' || professional.role === 'Gerente';
}

export function filterBookableProfessionals(professionals) {
  return (Array.isArray(professionals) ? professionals : []).filter(isBookableProfessional);
}
