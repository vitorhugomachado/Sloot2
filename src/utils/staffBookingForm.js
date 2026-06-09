import { isValidPhone, PHONE_ERROR } from './phone';

/** Valida reserva manual (agenda/dashboard) e retorna mensagem de erro ou null. */
export function getStaffBookingFormError({ customer, phone, serviceId, barberId, time, availableTimes }) {
  if (!(customer || '').trim()) {
    return 'Informe o nome.';
  }
  if (!String(phone || '').replace(/\D/g, '')) {
    return 'Informe o telefone.';
  }
  if (!isValidPhone(phone)) {
    return PHONE_ERROR;
  }
  if (!serviceId) {
    return 'Selecione o serviço.';
  }
  if (!barberId) {
    return 'Selecione o profissional.';
  }
  if (!Array.isArray(availableTimes) || availableTimes.length === 0) {
    return 'Não há horários livres neste dia para o profissional selecionado.';
  }
  if (!time || !availableTimes.includes(time)) {
    return 'Selecione um horário disponível.';
  }
  return null;
}
