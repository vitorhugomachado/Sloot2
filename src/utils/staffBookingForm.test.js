import { describe, expect, it } from 'vitest';
import { getStaffBookingFormError } from './staffBookingForm';
import { PHONE_ERROR } from './phone';

const validBase = {
  customer: 'João Silva',
  phone: '11987654321',
  serviceId: '1',
  barberId: '2',
  time: '10:00',
  availableTimes: ['09:00', '10:00', '11:00'],
};

describe('getStaffBookingFormError', () => {
  it('retorna null para payload válido', () => {
    expect(getStaffBookingFormError(validBase)).toBeNull();
  });

  it('exige nome do cliente', () => {
    expect(getStaffBookingFormError({ ...validBase, customer: '  ' })).toBe('Informe o nome.');
  });

  it('exige telefone', () => {
    expect(getStaffBookingFormError({ ...validBase, phone: '' })).toBe('Informe o telefone.');
  });

  it('rejeita telefone inválido', () => {
    expect(getStaffBookingFormError({ ...validBase, phone: '123' })).toBe(PHONE_ERROR);
  });

  it('exige serviço', () => {
    expect(getStaffBookingFormError({ ...validBase, serviceId: '' })).toBe('Selecione o serviço.');
  });

  it('exige profissional', () => {
    expect(getStaffBookingFormError({ ...validBase, barberId: '' })).toBe('Selecione o profissional.');
  });

  it('exige horários disponíveis na lista', () => {
    expect(
      getStaffBookingFormError({ ...validBase, availableTimes: [], time: '10:00' })
    ).toBe('Não há horários livres neste dia para o profissional selecionado.');
  });

  it('rejeita horário fora da lista disponível', () => {
    expect(
      getStaffBookingFormError({ ...validBase, time: '12:00' })
    ).toBe('Selecione um horário disponível.');
  });
});
