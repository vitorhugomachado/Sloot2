export const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];

export function isCardMethod(method) {
  return /cart[aã]o/i.test(String(method || ''));
}

export function cardKindFromMethod(method) {
  return /d[eé]bito/i.test(String(method || '')) ? 'DEBIT' : 'CREDIT';
}

export function estimateCardFee(split, cardFeeRates = []) {
  if (!isCardMethod(split?.method)) return { pct: 0, fee: 0, label: '—' };
  const kind = split.cardKind || cardKindFromMethod(split.method);
  const brand = split.cardBrand || 'Visa';
  const rate = cardFeeRates.find((r) => r.brand === brand && r.kind === kind);
  const pct = Number(rate?.feePct || 0);
  const fee = Math.round(Number(split.amount || 0) * (pct / 100) * 100) / 100;
  return {
    pct,
    fee,
    label: `${pct}% → R$ ${fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (debita da comissão)`,
  };
}
