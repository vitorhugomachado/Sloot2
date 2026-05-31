import { useState, useMemo, useEffect } from 'react';
import { todayIsoLocal } from '../utils/dateLocal';

const EMPTY_CHECKOUT_PRODUCT = { productId: '', quantity: 1 };

export function formatCheckoutCurrency(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
}) {
  const [actionModal, setActionModal] = useState({ open: false, app: null, step: 'choose' });
  const [paymentSplits, setPaymentSplits] = useState([{ method: 'Pix', amount: 0 }]);
  const [checkoutProducts, setCheckoutProducts] = useState([EMPTY_CHECKOUT_PRODUCT]);

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

  useEffect(() => {
    if (!(actionModal.open && actionModal.step === 'payment')) return;
    setPaymentSplits((prev) => {
      if (prev.length !== 1) return prev;
      const currentAmount = Number(prev[0]?.amount || 0);
      if (Math.abs(currentAmount - checkoutGrandTotal) < 0.01) return prev;
      return [{ ...prev[0], amount: checkoutGrandTotal }];
    });
  }, [actionModal.open, actionModal.step, checkoutGrandTotal]);

  const resetCheckoutState = (app) => {
    setPaymentSplits([{ method: 'Pix', amount: Number(app?.price || 0) }]);
    setCheckoutProducts([EMPTY_CHECKOUT_PRODUCT]);
  };

  const openActionModal = (app) => {
    if (!app || app.status === 'Finalizado' || app.status === 'Cancelado') return;
    setActionModal({ open: true, app, step: 'choose' });
    resetCheckoutState(app);
  };

  const closeActionModal = () => {
    setActionModal({ open: false, app: null, step: 'choose' });
    setCheckoutProducts([EMPTY_CHECKOUT_PRODUCT]);
  };

  const handleMarkInProgress = async () => {
    const success = await updateAppointmentStatus(actionModal.app.id, 'Em progresso');
    if (success) closeActionModal();
  };

  const handleCancelAppointment = async () => {
    const success = await cancelAppointment(actionModal.app.id);
    if (success) closeActionModal();
  };

  const handleFinalizePayment = async () => {
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
        alert('Um produto selecionado não está cadastrado.');
        return;
      }
      if (Number(product.stock || 0) < item.quantity) {
        alert(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
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

    const requiredTotal = Number(actionModal.app.price || 0) + productsTotal;
    const totalPaid = paymentSplits.reduce((acc, curr) => acc + Number(curr.amount), 0);
    if (Math.abs(totalPaid - requiredTotal) > 0.01) {
      alert(
        `O valor total pago (R$ ${totalPaid.toFixed(2)}) deve ser igual ao total do checkout (R$ ${requiredTotal.toFixed(2)}).`
      );
      return;
    }

    const paidAt = todayIsoLocal();

    for (const item of selectedProducts) {
      const saleOk = await sellProduct(
        item.productId,
        item.quantity,
        actionModal.app.barberId || null,
        { saleDate: paidAt },
      );
      if (!saleOk) {
        alert('Não foi possível registrar um dos produtos no estoque.');
        return;
      }
    }

    const success = await updateAppointmentStatus(actionModal.app.id, 'Finalizado', {
      payments: {
        splits: paymentSplits,
        products: selectedProductsDetailed,
        serviceTotal: Number(actionModal.app.price || 0),
        productsTotal,
        totalCheckout: requiredTotal,
        paidAt,
      },
    });
    if (success) closeActionModal();
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

  return {
    actionModal,
    setActionModal,
    paymentSplits,
    setPaymentSplits,
    checkoutProducts,
    setCheckoutProducts,
    checkoutServiceTotal,
    checkoutProductsTotal,
    checkoutGrandTotal,
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
    formatCheckoutCurrency,
  };
}
