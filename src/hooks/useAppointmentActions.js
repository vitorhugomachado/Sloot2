import { useState, useMemo, useEffect } from 'react';
import { todayIsoLocal } from '../utils/dateLocal';
import { openWhatsAppConfirm } from '../utils/appointmentWhatsApp';
import { CASH_STATUS_CHANGED } from '../utils/cashStatusEvents';
import { showStaffToast } from '../utils/staffToast';
import { useCashStatus } from './useCashStatus';

const EMPTY_CHECKOUT_PRODUCT = { productId: '', quantity: 1 };
const WHATSAPP_CONFIRMABLE = new Set(['Agendado', 'Pendente']);

export function formatCheckoutCurrency(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCashOptionLabel(session) {
  if (!session) return 'Caixa';
  const when = session.openedAt
    ? new Date(session.openedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const who = session.openedByName || 'Caixa';
  return when ? `${who} · ${when}` : who;
}

/**
 * Estado e handlers compartilhados do modal de ações (Dashboard + Scheduler).
 */
export function useAppointmentActions({
  services,
  products,
  updateAppointmentStatus,
  cancelAppointment,
  sellProduct,
  financeV2,
}) {
  const [actionModal, setActionModal] = useState({ open: false, app: null, step: 'choose' });
  const [paymentSplits, setPaymentSplits] = useState([{ method: 'Pix', amount: 0 }]);
  const [checkoutProducts, setCheckoutProducts] = useState([EMPTY_CHECKOUT_PRODUCT]);
  const [openCashSessions, setOpenCashSessions] = useState([]);
  const [cashSessionId, setCashSessionId] = useState('');
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false);
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const [checkoutTip, setCheckoutTip] = useState(0);
  const [checkoutAllowPartial, setCheckoutAllowPartial] = useState(false);
  const [cardFeeRates, setCardFeeRates] = useState([]);
  const {
    isOpen: cashOpen,
    loading: cashStatusLoading,
    refresh: refreshCashStatus,
  } = useCashStatus(financeV2, { enabled: Boolean(financeV2?.getCurrentCash) });

  const checkoutServiceTotal = Number(actionModal.app?.price || 0);

  const checkoutProductsTotal = useMemo(() => {
    return checkoutProducts.reduce((sum, item) => {
      if (!item.productId) return sum;
      const product = products.find((p) => Number(p.id) === Number(item.productId));
      if (!product) return sum;
      const qty = Math.max(1, Number(item.quantity || 1));
      return sum + Number(product.price || 0) * qty;
    }, 0);
  }, [checkoutProducts, products]);

  const checkoutGrandTotal = checkoutServiceTotal + checkoutProductsTotal;
  const checkoutPayableTotal = Math.max(
    0,
    Math.round((checkoutGrandTotal - Number(checkoutDiscount || 0) + Number(checkoutTip || 0)) * 100) / 100,
  );

  useEffect(() => {
    if (!(actionModal.open && actionModal.step === 'payment')) return;
    if (checkoutAllowPartial) return;
    setPaymentSplits((prev) => {
      if (prev.length !== 1) return prev;
      const currentAmount = Number(prev[0]?.amount || 0);
      if (Math.abs(currentAmount - checkoutPayableTotal) < 0.01) return prev;
      return [{ ...prev[0], amount: checkoutPayableTotal }];
    });
  }, [actionModal.open, actionModal.step, checkoutPayableTotal, checkoutAllowPartial]);

  useEffect(() => {
    if (!(actionModal.open && actionModal.step === 'payment') || !financeV2?.listCashSessions) {
      return undefined;
    }
    let cancelled = false;
    const loadOpenSessions = () => {
      setCashSessionsLoading(true);
      financeV2
        .listCashSessions()
        .then((sessions) => {
          if (cancelled) return;
          const open = (Array.isArray(sessions) ? sessions : []).filter((s) => s.status === 'OPEN');
          setOpenCashSessions(open);
          setCashSessionId((prev) => {
            if (prev && open.some((s) => String(s.id) === String(prev))) return prev;
            return open.length === 1 ? String(open[0].id) : '';
          });
        })
        .catch(() => {
          if (!cancelled) {
            setOpenCashSessions([]);
            setCashSessionId('');
          }
        })
        .finally(() => {
          if (!cancelled) setCashSessionsLoading(false);
        });
    };
    loadOpenSessions();
    window.addEventListener(CASH_STATUS_CHANGED, loadOpenSessions);
    return () => {
      cancelled = true;
      window.removeEventListener(CASH_STATUS_CHANGED, loadOpenSessions);
    };
  }, [actionModal.open, actionModal.step, financeV2]);

  useEffect(() => {
    if (!(actionModal.open && actionModal.step === 'payment') || !financeV2?.listCardFees) {
      return undefined;
    }
    let cancelled = false;
    financeV2.listCardFees()
      .then((rates) => {
        if (!cancelled) setCardFeeRates(Array.isArray(rates) ? rates : []);
      })
      .catch(() => {
        if (!cancelled) setCardFeeRates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [actionModal.open, actionModal.step, financeV2]);

  useEffect(() => {
    if (!actionModal.open) return undefined;
    if (!['choose', 'confirm-start', 'payment'].includes(actionModal.step)) return undefined;
    refreshCashStatus();
    return undefined;
  }, [actionModal.open, actionModal.step, refreshCashStatus]);

  const resetCheckoutState = (app) => {
    setPaymentSplits([{ method: 'Pix', amount: Number(app?.price || 0) }]);
    setCheckoutProducts([EMPTY_CHECKOUT_PRODUCT]);
    setCashSessionId('');
    setCheckoutDiscount(0);
    setCheckoutTip(0);
    setCheckoutAllowPartial(false);
  };

  const openActionModal = (app) => {
    if (!app || app.status === 'Finalizado' || app.status === 'Cancelado') return;
    setActionModal({ open: true, app, step: 'choose' });
    resetCheckoutState(app);
  };

  const closeActionModal = () => {
    setActionModal({ open: false, app: null, step: 'choose' });
    setCheckoutProducts([EMPTY_CHECKOUT_PRODUCT]);
    setCashSessionId('');
  };

  const handleMarkInProgress = async () => {
    if (financeV2?.getCurrentCash) {
      const session = await refreshCashStatus();
      if (!session?.id) return;
    }
    const success = await updateAppointmentStatus(actionModal.app.id, 'Em progresso');
    if (success) closeActionModal();
  };

  const handleCancelAppointment = async () => {
    const success = await cancelAppointment(actionModal.app.id);
    if (success) closeActionModal();
  };

  const handleFinalizePayment = async () => {
    if (!cashSessionId) {
      showStaffToast('Selecione o caixa do dia para confirmar o recebimento.', { variant: 'warning' });
      return;
    }

    const selectedProducts = checkoutProducts
      .filter((item) => item.productId)
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Math.max(1, Number(item.quantity || 1)),
      }));

    let productsTotal = 0;
    const selectedProductsDetailed = [];
    for (const item of selectedProducts) {
      const product = products.find((p) => Number(p.id) === item.productId);
      if (!product) {
        showStaffToast('Um produto selecionado não está cadastrado.', { variant: 'error' });
        return;
      }
      if (Number(product.stock || 0) < item.quantity) {
        showStaffToast(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`, { variant: 'error' });
        return;
      }
      const subtotal = Number(product.price || 0) * item.quantity;
      productsTotal += subtotal;
      selectedProductsDetailed.push({
        id: Number(product.id),
        name: product.name,
        quantity: item.quantity,
        unitPrice: Number(product.price || 0),
        subtotal,
      });
    }

    const requiredTotal = checkoutPayableTotal;
    const totalPaid = paymentSplits.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const isFullPayment = totalPaid >= requiredTotal - 0.01;

    if (!checkoutAllowPartial && !isFullPayment) {
      showStaffToast(
        `O valor total pago (R$ ${totalPaid.toFixed(2)}) deve ser igual ao total a receber (R$ ${requiredTotal.toFixed(2)}).`,
        { variant: 'warning' },
      );
      return;
    }
    if (checkoutAllowPartial && totalPaid <= 0) {
      showStaffToast('Informe um valor maior que zero para o recebimento parcial.', { variant: 'warning' });
      return;
    }
    if (checkoutAllowPartial && totalPaid > requiredTotal + 0.01) {
      showStaffToast(
        `Pagamento (R$ ${totalPaid.toFixed(2)}) excede o total (R$ ${requiredTotal.toFixed(2)}).`,
        { variant: 'warning' },
      );
      return;
    }

    for (const split of paymentSplits) {
      if (/cart[aã]o/i.test(String(split.method || '')) && !String(split.cardBrand || '').trim()) {
        showStaffToast('Informe a bandeira do cartão em cada pagamento com cartão.', { variant: 'warning' });
        return;
      }
    }

    const paidAt = todayIsoLocal();
    const nextStatus = isFullPayment ? 'Finalizado' : actionModal.app.status;

    const success = await updateAppointmentStatus(actionModal.app.id, nextStatus, {
      payments: {
        splits: paymentSplits.map((s) => ({
          ...s,
          cardKind: /d[eé]bito/i.test(String(s.method || ''))
            ? 'DEBIT'
            : (/cr[eé]dito/i.test(String(s.method || '')) ? 'CREDIT' : s.cardKind),
        })),
        products: selectedProductsDetailed,
        serviceTotal: Number(actionModal.app.price || 0),
        productsTotal,
        itemsTotal: checkoutGrandTotal,
        discountAmount: Number(checkoutDiscount || 0),
        tipAmount: Number(checkoutTip || 0),
        totalCheckout: requiredTotal,
        paidAt,
        cashSessionId: Number(cashSessionId),
        allowPartial: checkoutAllowPartial && !isFullPayment,
      },
    });
    if (success) {
      if (isFullPayment) {
        closeActionModal();
      } else {
        showStaffToast('Recebimento parcial registrado. Saldo em aberto na comanda.', { variant: 'info' });
        closeActionModal();
      }
    }
  };

  const handleAddSplit = () => setPaymentSplits([...paymentSplits, { method: 'Pix', amount: 0 }]);

  const handleChangeService = async (newServiceId) => {
    const s = services.find((sv) => String(sv.id) === String(newServiceId));
    if (!s) return;
    await updateAppointmentStatus(actionModal.app.id, actionModal.app.status, {
      service: s.name,
      price: s.price,
    });
    setActionModal({
      ...actionModal,
      app: { ...actionModal.app, service: s.name, price: s.price },
    });
  };

  const handleSplitChange = (index, field, value) => {
    const newSplits = [...paymentSplits];
    newSplits[index][field] = value;
    setPaymentSplits(newSplits);
  };

  const handleAddCheckoutProduct = () =>
    setCheckoutProducts((prev) => [...prev, { ...EMPTY_CHECKOUT_PRODUCT }]);

  const handleCheckoutProductChange = (index, field, value) => {
    const next = [...checkoutProducts];
    next[index][field] = value;
    setCheckoutProducts(next);
  };

  const handleQuickStart = (app, event) => {
    event?.stopPropagation?.();
    setActionModal({ open: true, app, step: 'confirm-start' });
    resetCheckoutState(app);
  };

  const handleQuickConfirm = (app, event) => {
    event?.stopPropagation?.();
    setActionModal({ open: true, app, step: 'payment' });
    resetCheckoutState(app);
  };

  const handleQuickCancel = (app, event) => {
    event?.stopPropagation?.();
    setActionModal({ open: true, app, step: 'confirm-cancel' });
    resetCheckoutState(app);
  };

  const handleWhatsAppConfirm = async (app, event) => {
    event?.stopPropagation?.();
    if (!app || app.status === 'Cancelado' || app.status === 'Finalizado') return false;
    const opened = openWhatsAppConfirm(app);
    if (!opened) return false;
    if (WHATSAPP_CONFIRMABLE.has(String(app.status || '').trim())) {
      const success = await updateAppointmentStatus(app.id, 'Confirmado');
      if (success) {
        setActionModal((prev) => {
          if (!prev.open || !prev.app || String(prev.app.id) !== String(app.id)) return prev;
          return { ...prev, app: { ...prev.app, status: 'Confirmado' } };
        });
      }
    }
    return true;
  };

  return {
    actionModal,
    setActionModal,
    paymentSplits,
    setPaymentSplits,
    checkoutProducts,
    setCheckoutProducts,
    openCashSessions,
    cashSessionId,
    setCashSessionId,
    cashSessionsLoading,
    cashOpen,
    cashStatusLoading,
    cashCheckEnabled: Boolean(financeV2?.getCurrentCash),
    checkoutDiscount,
    setCheckoutDiscount,
    checkoutTip,
    setCheckoutTip,
    checkoutAllowPartial,
    setCheckoutAllowPartial,
    cardFeeRates,
    formatCashOptionLabel,
    checkoutServiceTotal,
    checkoutProductsTotal,
    checkoutGrandTotal,
    checkoutPayableTotal,
    openActionModal,
    closeActionModal,
    handleMarkInProgress,
    handleCancelAppointment,
    handleFinalizePayment,
    handleAddSplit,
    handleSplitChange,
    handleChangeService,
    handleAddCheckoutProduct,
    handleCheckoutProductChange,
    handleQuickStart,
    handleQuickConfirm,
    handleQuickCancel,
    handleWhatsAppConfirm,
    formatCheckoutCurrency,
  };
}
