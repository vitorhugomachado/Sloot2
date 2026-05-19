export const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '');

export const isValidPhone = (raw) => {
  const digits = normalizePhone(raw);
  return digits.length >= 10 && digits.length <= 11;
};

export const PHONE_ERROR = 'Informe um telefone válido (DDD + número, 10 ou 11 dígitos).';
