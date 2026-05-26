import React, { useState, useMemo, useEffect } from 'react';
import { Users, Calendar, Clock, X, ShoppingBag, Plus, ChevronLeft, ChevronRight, LayoutGrid, Play, CheckCircle, XCircle, Banknote } from 'lucide-react';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import { useApp } from '../context/AppContext';

const EMPTY_DIRECT_SALE = {
  customerName: '',
  barberId: '',
  items: [{ productId: '', quantity: 1 }],
};
import { filterAvailableBookingTimes, isBookingSlotTaken } from '../utils/bookingAvailability';
import { toIsoLocal } from '../utils/dateLocal';
import { computeOccupancyForPeriod } from '../utils/occupancyStats';
import OccupancyGauge from '../components/OccupancyGauge';
import DashUpcomingEmpty from '../components/dashboard/DashUpcomingEmpty';

/* ─────────── KPI Card ─────────── */
const KpiCard = ({ label, value, subtitle, stagger }) => (
  <div className={`dash-kpi-card stagger-${stagger}`}>
    <div className="dash-kpi-top">
      <span className="dash-kpi-label">{label}</span>
      <div className="dash-kpi-arrow"><ChevronRight size={14} /></div>
    </div>
    <div className="dash-kpi-main">
      <div className="dash-kpi-data">
        <div className="dash-kpi-value">{value}</div>
        {subtitle && <div className="dash-kpi-subtitle">{subtitle}</div>}
      </div>
    </div>
  </div>
);

/* ─────────── Mini Calendar ─────────── */
const MiniCalendar = ({ focusDate, onDateSelect }) => {
  const today = new Date();
  const d = new Date(focusDate + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - dayOfWeek);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(startOfWeek);
    dd.setDate(startOfWeek.getDate() + i);
    days.push(dd);
  }
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="dash-mini-cal">
      <div className="dash-mini-cal-grid">
        {days.map((dd, i) => {
          const ddStr = toIsoLocal(dd);
          const isActive = ddStr === focusDate;
          const isToday = dd.getDate() === today.getDate() && dd.getMonth() === today.getMonth() && dd.getFullYear() === today.getFullYear();
          
          return (
            <div 
              key={i} 
              className={`dash-mini-cal-col ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => onDateSelect && onDateSelect(ddStr)}
              style={{ cursor: 'pointer' }}
            >
              <div className="dash-mini-cal-day-label">{dayLabels[i]}</div>
              <div className="dash-mini-cal-day-num">{dd.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DASHBOARD_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const PERIOD_OPTIONS = [
  { d: 0, l: 'Hoje' },
  { d: 7, l: '7 dias' },
  { d: 15, l: '15 dias' },
  { d: 30, l: '30 dias' },
];

const getPeriodLabel = (days) => {
  const match = PERIOD_OPTIONS.find((p) => p.d === days);
  return match ? match.l : `${days} dias`;
};

/* ─────────── Main Dashboard ─────────── */
const Dashboard = () => {
  const {
    barbers, appointments, services, products,
    addAppointment, sellProduct, getFinancialStats, getBarberRanking,
    updateAppointmentStatus, cancelAppointment, currentUser
  } = useApp();

  const todayStr = toIsoLocal(new Date());
  const [focusDate, setFocusDate] = useState(todayStr);
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState(7);
  const isBarber = currentUser?.role === 'Barbeiro';

  const dashboardPeriodDates = useMemo(() => {
    if (dashboardPeriodDays === 0) {
      return { start: todayStr, end: todayStr };
    }
    const end = new Date(todayStr);
    const start = new Date(todayStr);
    start.setDate(start.getDate() - Math.max(dashboardPeriodDays - 1, 0));
    return {
      start: toIsoLocal(start),
      end: toIsoLocal(end)
    };
  }, [todayStr, dashboardPeriodDays]);

  const periodLabel = getPeriodLabel(dashboardPeriodDays);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ open: false, app: null });

  // ─── Action Modal State (replaces the old payment-only modal) ───
  const [actionModal, setActionModal] = useState({ open: false, app: null, step: 'choose' }); // step: 'choose' | 'payment' | 'confirm-start' | 'confirm-cancel'
  const [paymentSplits, setPaymentSplits] = useState([{ method: 'Pix', amount: 0 }]);
  const [checkoutProducts, setCheckoutProducts] = useState([{ productId: '', quantity: 1 }]);
  
  const [formData, setFormData] = useState({
    customer: '', phone: '', serviceId: '', barberId: '', time: '09:00', date: focusDate
  });
  const [saleForm, setSaleForm] = useState(EMPTY_DIRECT_SALE);

  const activeBarbers = useMemo(
    () => barbers.filter(b => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers]
  );
  const stats = useMemo(
    () => getFinancialStats(dashboardPeriodDates.start, dashboardPeriodDates.end),
    [getFinancialStats, dashboardPeriodDates.start, dashboardPeriodDates.end]
  );
  const ranking = useMemo(
    () => getBarberRanking(dashboardPeriodDates.start, dashboardPeriodDates.end),
    [getBarberRanking, dashboardPeriodDates.start, dashboardPeriodDates.end]
  );

  // Recent activity — already filtered by backend for barbers
  const recentActivity = useMemo(() => {
    return [...appointments]
      .sort((a, b) => {
        const aTouched = Number(a._updatedAtLocal || 0);
        const bTouched = Number(b._updatedAtLocal || 0);
        if (aTouched !== bTouched) return bTouched - aTouched;
        return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
      })
      .slice(0, 6);
  }, [appointments]);

  // Upcoming — already filtered by backend for barbers
  const upcoming = useMemo(() => {
    return appointments
      .filter(a => ['Agendado', 'Confirmado', 'Em progresso'].includes(a.status) && a.date === focusDate)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 50);
  }, [appointments, focusDate]);

  const occupancyBarbers = useMemo(() => {
    if (isBarber) {
      const self = activeBarbers.find((b) => b.id === currentUser.id);
      return self ? [self] : [];
    }
    return activeBarbers;
  }, [activeBarbers, isBarber, currentUser?.id]);

  const occupancyStats = useMemo(
    () =>
      computeOccupancyForPeriod({
        startDate: dashboardPeriodDates.start,
        endDate: dashboardPeriodDates.end,
        barbers: occupancyBarbers,
        appointments,
      }),
    [dashboardPeriodDates.start, dashboardPeriodDates.end, occupancyBarbers, appointments]
  );

  const cancelStats = useMemo(() => {
    const periodApps = appointments.filter(
      (a) => a.date >= dashboardPeriodDates.start && a.date <= dashboardPeriodDates.end
    );
    const cancelledCount = periodApps.filter((a) => a.status === 'Cancelado').length;
    const rate = periodApps.length > 0
      ? Math.round((cancelledCount / periodApps.length) * 100)
      : 0;
    return { rate, cancelledCount, total: periodApps.length };
  }, [appointments, dashboardPeriodDates.start, dashboardPeriodDates.end]);

  const saleLineItems = useMemo(
    () =>
      saleForm.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: Number(item.productId),
          quantity: Math.max(1, Number(item.quantity || 1)),
        })),
    [saleForm.items]
  );

  const saleTotal = useMemo(() => {
    return saleLineItems.reduce((sum, item) => {
      const product = products.find((p) => Number(p.id) === item.productId);
      if (!product) return sum;
      return sum + Number(product.price || 0) * item.quantity;
    }, 0);
  }, [saleLineItems, products]);

  const handleSaleItemChange = (index, field, value) => {
    setSaleForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleAddSaleItem = () => {
    setSaleForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }],
    }));
  };

  const handleRemoveSaleItem = (index) => {
    setSaleForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const closeSaleModal = () => {
    setIsSaleModalOpen(false);
    setSaleForm(EMPTY_DIRECT_SALE);
  };

  /* ─── Handlers ─── */
  const handleConfirmDirectSale = async () => {
    if (saleLineItems.length === 0) return;

    for (const item of saleLineItems) {
      const product = products.find((p) => Number(p.id) === item.productId);
      if (!product) {
        alert('Um produto selecionado não está cadastrado.');
        return;
      }
      if (Number(product.stock || 0) < item.quantity) {
        alert(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
        return;
      }
    }

    const barberId = saleForm.barberId ? parseInt(saleForm.barberId, 10) : null;
    const saleMeta = {
      customerId: null,
      customerName: saleForm.customerName.trim() ? saleForm.customerName.trim() : null,
    };

    for (const item of saleLineItems) {
      const ok = await sellProduct(item.productId, item.quantity, barberId, saleMeta);
      if (!ok) {
        alert('Não foi possível concluir a venda. Verifique o estoque.');
        return;
      }
    }

    closeSaleModal();
  };

  // ─── Action Modal handlers ───
  const openActionModal = (app) => {
    if (!app || app.status === 'Finalizado' || app.status === 'Cancelado') return;
    setActionModal({ open: true, app, step: 'choose' });
    setPaymentSplits([{ method: 'Pix', amount: app.price }]);
    setCheckoutProducts([{ productId: '', quantity: 1 }]);
  };

  const closeActionModal = () => {
    setActionModal({ open: false, app: null, step: 'choose' });
    setCheckoutProducts([{ productId: '', quantity: 1 }]);
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
      .filter(item => item.productId)
      .map(item => ({
        productId: Number(item.productId),
        quantity: Math.max(1, Number(item.quantity || 1))
      }));

    let productsTotal = 0;
    const selectedProductsDetailed = [];
    for (const item of selectedProducts) {
      const product = products.find(p => Number(p.id) === item.productId);
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
        subtotal
      });
    }

    const requiredTotal = Number(actionModal.app.price || 0) + productsTotal;
    const totalPaid = paymentSplits.reduce((acc, curr) => acc + Number(curr.amount), 0);
    if (Math.abs(totalPaid - requiredTotal) > 0.01) {
      alert(`O valor total pago (R$ ${totalPaid.toFixed(2)}) deve ser igual ao total do checkout (R$ ${requiredTotal.toFixed(2)}).`);
      return;
    }

    for (const item of selectedProducts) {
      const saleOk = await sellProduct(item.productId, item.quantity, actionModal.app.barberId || null);
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
        totalCheckout: requiredTotal
      }
    });
    if (success) closeActionModal();
  };

  const handleAddSplit = () => setPaymentSplits([...paymentSplits, { method: 'Pix', amount: 0 }]);
  
  const handleChangeService = async (newServiceId) => {
    const s = services.find(sv => String(sv.id) === String(newServiceId));
    if (!s) return;
    await updateAppointmentStatus(actionModal.app.id, actionModal.app.status, {
      service: s.name,
      price: s.price
    });
    setActionModal({
      ...actionModal,
      app: { ...actionModal.app, service: s.name, price: s.price }
    });
  };
  const handleSplitChange = (index, field, value) => {
    const newSplits = [...paymentSplits];
    newSplits[index][field] = value;
    setPaymentSplits(newSplits);
  };
  const handleAddCheckoutProduct = () => setCheckoutProducts(prev => [...prev, { productId: '', quantity: 1 }]);
  const handleCheckoutProductChange = (index, field, value) => {
    const next = [...checkoutProducts];
    next[index][field] = value;
    setCheckoutProducts(next);
  };

  const openNewAppModal = (barberId = '', time = '09:00') => {
    const defaultBarberId = isBarber ? String(currentUser.id) : String(barberId);
    setFormData({ customer: '', phone: '', serviceId: '', barberId: defaultBarberId, time, date: focusDate });
    setIsModalOpen(true);
  };

  const dashboardBookingBarberId = isBarber ? String(currentUser.id) : formData.barberId;
  const availableDashboardBookingTimes = useMemo(
    () => filterAvailableBookingTimes(DASHBOARD_TIME_SLOTS, appointments, formData.date, dashboardBookingBarberId),
    [appointments, formData.date, dashboardBookingBarberId]
  );

  useEffect(() => {
    if (!isModalOpen) return;
    const list = filterAvailableBookingTimes(DASHBOARD_TIME_SLOTS, appointments, formData.date, dashboardBookingBarberId);
    setFormData((prev) => {
      if (list.length === 0) {
        return prev.time === '' ? prev : { ...prev, time: '' };
      }
      if (list.includes(prev.time)) return prev;
      return { ...prev, time: list[0] };
    });
  }, [isModalOpen, formData.date, dashboardBookingBarberId, appointments]);

  const handleSaveAppointment = () => {
    const phoneOk = String(formData.phone || '').replace(/\D/g, '').length >= 8;
    if (!formData.customer.trim() || !phoneOk || !formData.serviceId || !formData.barberId) return;
    const effectiveTime =
      availableDashboardBookingTimes.length > 0
        ? availableDashboardBookingTimes.includes(formData.time)
          ? formData.time
          : availableDashboardBookingTimes[0]
        : '';
    if (!effectiveTime) {
      window.alert('Não há horário disponível para concluir a reserva.');
      return;
    }
    if (isBookingSlotTaken(appointments, formData.date, effectiveTime, formData.barberId)) {
      window.alert(
        'Este horário já está reservado para o profissional selecionado. Escolha outro horário disponível na lista.'
      );
      return;
    }
    const selectedService = services.find(s => String(s.id) === String(formData.serviceId));
    addAppointment({
      customer: formData.customer, phone: formData.phone,
      service: selectedService?.name || 'Serviço',
      barberId: parseInt(formData.barberId),
      date: formData.date, time: effectiveTime,
      status: 'Agendado', price: selectedService?.price || 0
    });
    setIsModalOpen(false);
    setFormData({ customer: '', phone: '', serviceId: '', barberId: '', time: '09:00', date: focusDate });
  };

  const barberColors = ['#2563EB', '#10B981', '#f59e0b', '#ec4899', '#64748B'];
  const maxRevenue = ranking.length > 0 ? Math.max(...ranking.map(b => b.revenue), 1) : 1;
  const formatCurrency = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const checkoutProductsTotal = useMemo(() => {
    return checkoutProducts.reduce((sum, item) => {
      if (!item.productId) return sum;
      const product = products.find(p => Number(p.id) === Number(item.productId));
      if (!product) return sum;
      const qty = Math.max(1, Number(item.quantity || 1));
      return sum + (Number(product.price || 0) * qty);
    }, 0);
  }, [checkoutProducts, products]);
  const checkoutServiceTotal = Number(actionModal.app?.price || 0);
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

  const normalizePhoneForWhatsApp = (phone) => {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (!digits.startsWith('55')) digits = `55${digits}`;
    return digits;
  };

  const toBrDate = (isoDate) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate || '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const buildWhatsAppMessage = (app) => {
    const msg = `Olá ${app.customer}, tudo bem? Poderia confirmar seu agendamento em ${toBrDate(app.date)} às ${app.time}?`;
    return encodeURIComponent(msg);
  };

  const openWhatsAppConfirm = (app, event) => {
    event.stopPropagation();
    const normalizedPhone = normalizePhoneForWhatsApp(app.phone);
    if (!normalizedPhone) return;
    const encodedMessage = buildWhatsAppMessage(app);
    const url = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openReceiptModal = (app) => {
    if (!app || app.status !== 'Finalizado') return;
    setReceiptModal({ open: true, app });
  };

  const closeReceiptModal = () => setReceiptModal({ open: false, app: null });

  const getReceiptData = (app) => {
    const rawPayments = app?.payments;
    if (Array.isArray(rawPayments)) {
      const serviceTotal = Number(app?.price || 0);
      return {
        splits: rawPayments,
        products: [],
        serviceTotal,
        productsTotal: 0,
        totalCheckout: serviceTotal
      };
    }
    if (rawPayments && typeof rawPayments === 'object') {
      const splits = Array.isArray(rawPayments.splits) ? rawPayments.splits : [];
      const products = Array.isArray(rawPayments.products) ? rawPayments.products : [];
      const serviceTotal = Number(rawPayments.serviceTotal ?? app?.price ?? 0);
      const productsTotal = Number(rawPayments.productsTotal ?? products.reduce((acc, p) => acc + Number(p.subtotal || (Number(p.unitPrice || 0) * Number(p.quantity || 0))), 0));
      const totalCheckout = Number(rawPayments.totalCheckout ?? (serviceTotal + productsTotal));
      return { splits, products, serviceTotal, productsTotal, totalCheckout };
    }
    const serviceTotal = Number(app?.price || 0);
    return { splits: [], products: [], serviceTotal, productsTotal: 0, totalCheckout: serviceTotal };
  };

  const handleQuickStart = (app, event) => {
    event.stopPropagation();
    setActionModal({ open: true, app, step: 'confirm-start' });
    setPaymentSplits([{ method: 'Pix', amount: Number(app.price || 0) }]);
    setCheckoutProducts([{ productId: '', quantity: 1 }]);
  };

  const handleQuickConfirm = async (app, event) => {
    event.stopPropagation();
    setActionModal({ open: true, app, step: 'payment' });
    setPaymentSplits([{ method: 'Pix', amount: Number(app.price || 0) }]);
    setCheckoutProducts([{ productId: '', quantity: 1 }]);
  };

  const handleQuickCancel = (app, event) => {
    event.stopPropagation();
    setActionModal({ open: true, app, step: 'confirm-cancel' });
    setPaymentSplits([{ method: 'Pix', amount: Number(app.price || 0) }]);
    setCheckoutProducts([{ productId: '', quantity: 1 }]);
  };

  const IN_SERVICE_COLOR = '#93C5FD';
  const isInServiceStatus = (status) => {
    const s = String(status || '').trim().toLowerCase();
    return s === 'em progresso' || s === 'em atendimento';
  };

  const getStatusConfig = (status) => {
    const s = String(status || '').trim();
    switch (s) {
      case 'Finalizado':
        return { color: '#16a34a', lineColor: 'rgba(22, 163, 74, 0.4)', label: 'Pago' };
      case 'Em progresso':
      case 'Em atendimento':
        return {
          color: IN_SERVICE_COLOR,
          lineColor: 'rgba(147, 197, 253, 0.55)',
          label: 'Em atendimento',
        };
      case 'Cancelado':
        return { color: '#dc2626', lineColor: 'rgba(220, 38, 38, 0.4)', label: 'Cancelado' };
      case 'Agendado':
        return { color: '#64748b', lineColor: 'rgba(100, 116, 139, 0.35)', label: 'Agendado' };
      case 'Confirmado':
        return { color: '#0d9488', lineColor: 'rgba(13, 148, 136, 0.4)', label: 'Confirmado' };
      default:
        if (isInServiceStatus(s)) {
          return {
            color: IN_SERVICE_COLOR,
            lineColor: 'rgba(147, 197, 253, 0.55)',
            label: 'Em atendimento',
          };
        }
        return { color: 'var(--text-secondary)', lineColor: 'var(--border-color)', label: s || status };
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-page__inner">

      {/* ═══════ HEADER ═══════ */}
      <div className="dash-header">
        <h1>{isBarber ? `Meu Dashboard` : 'Dashboard'}</h1>
        <div className="dash-header-actions">
          {!isBarber && (
            <button className="dash-action-btn secondary" onClick={() => setIsSaleModalOpen(true)}>
              <ShoppingBag size={16} /> Venda Rápida
            </button>
          )}
          <button className="dash-action-btn primary" onClick={() => openNewAppModal()}>
            <Plus size={16} /> Agendamento
          </button>
        </div>
      </div>

      {/* ═══════ KPI ROW ═══════ */}
      <div className="dash-kpi-section">
        <div className="dash-kpi-section-header">
          <span className="dash-kpi-section-title">Indicadores</span>
          <div className="dash-toggle-group">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.d}
                type="button"
                className={`dash-toggle-btn ${dashboardPeriodDays === p.d ? 'active' : ''}`}
                onClick={() => setDashboardPeriodDays(p.d)}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
        <div className="dash-kpi-row">
          <KpiCard
            label={isBarber ? 'Meu faturamento' : 'Faturamento'}
            value={`R$${stats.revenue.toLocaleString('pt-BR')}`}
            subtitle={`Serviços finalizados + produtos · ${periodLabel}`}
            stagger={1}
          />
          <OccupancyGauge
            value={occupancyStats.rate}
            label={isBarber ? 'Minha ocupação' : 'Ocupação'}
            subtitle={`${occupancyStats.occupied} de ${occupancyStats.capacity} vagas · ${periodLabel}`}
            stagger={2}
          />
          <KpiCard
            label="Taxa de Cancelamento"
            value={`${cancelStats.rate}%`}
            subtitle={
              cancelStats.total > 0
                ? `${cancelStats.cancelledCount} de ${cancelStats.total} agendamentos · ${periodLabel}`
                : `Nenhum agendamento · ${periodLabel}`
            }
            stagger={3}
          />
          <KpiCard
            label={isBarber ? 'Meu ticket médio' : 'Ticket Médio'}
            value={`R$${stats.averageTicket.toFixed(0)}`}
            subtitle={`Média por atendimento/venda finalizada · ${periodLabel}`}
            stagger={4}
          />
        </div>
      </div>

      {/* ═══════ BOTTOM 3-COLUMN GRID ═══════ */}
      <div className="dash-bottom-grid">

        {/* ─── Col 1: Performance ─── */}
        <div className="dash-panel dash-panel-performance">
          <div className="dash-panel-header">
            <h3>{isBarber ? 'Minha Performance' : 'Performance por Profissional'}</h3>
            <span className="dash-panel-period-label">{periodLabel}</span>
          </div>
          <div className="dash-panel-body">
            {ranking.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                Nenhum dado encontrado para este período.
              </p>
            ) : (
              ranking.map((barber, idx) => {
                const commissionPercent = Math.max(0, Math.min(100, Number(barber.commission ?? 50)));
                const barbershopCommissionValue = barber.revenue * (commissionPercent / 100);
                const barFillPct = (barber.revenue / maxRevenue) * 100;
                const commissionStripePct = barber.revenue > 0 ? (barbershopCommissionValue / barber.revenue) * 100 : 0;
                const barTooltip = `Faturamento total: ${formatCurrency(barber.revenue)} | Comissão da barbearia (${commissionPercent}%): ${formatCurrency(barbershopCommissionValue)}`;

                return (
                <div key={barber.id} className="dash-bar-item">
                  <div className="dash-bar-label">
                    <div className="dash-bar-name">
                      <div className="dash-bar-avatar" style={{ background: barberColors[idx] || '#94a3b8', overflow: 'hidden' }}>
                        {barber.foto_perfil ? (
                          <img src={barber.foto_perfil} alt={barber.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          barber.name.charAt(0)
                        )}
                      </div>
                      {barber.name}
                    </div>
                    <span className="dash-bar-value">{formatCurrency(barber.revenue)}</span>
                  </div>
                  <div
                    className="dash-bar-track"
                    title={barTooltip}
                    aria-label={barTooltip}
                  >
                    <div className="dash-bar-fill" style={{ width: `${barFillPct}%` }}>
                      <div className="dash-bar-commission-overlay" style={{ width: `${commissionStripePct}%` }} />
                    </div>
                  </div>
                  {/* Extra stats for barbers viewing their own data */}
                  {isBarber && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>🎯 {barber.count} atendimentos</span>
                      <span>💈 R$ {barber.serviceRevenue.toLocaleString('pt-BR')} serviços</span>
                      <span>🛒 R$ {barber.productRevenue.toLocaleString('pt-BR')} produtos</span>
                    </div>
                  )}
                </div>
                );
              })
            )}
            {!isBarber && ranking.length > 0 && (
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap' }}>
                {ranking.slice(0, 3).map((b, idx) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <div className="dash-legend-dot" style={{ background: barberColors[idx % barberColors.length] }} />
                    {b.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Col 2: Atividade Recente ─── */}
        <div className="dash-panel dash-panel-activity">
          <div className="dash-panel-header">
            <h3>Atividade Recente</h3>
            <button className="dash-icon-btn"><LayoutGrid size={16} /></button>
          </div>
          <div className="dash-panel-body">
            {recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                Nenhuma atividade recente.
              </p>
            ) : (
              <div className="dash-timeline">
                {recentActivity.map((app, idx) => {
                  const cfg = getStatusConfig(app.status);
                  const dateParts = String(app.date || '').split('-');
                  const dateStr =
                    dateParts.length === 3
                      ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0].slice(2)}`
                      : String(app.date || '');
                  const barberName = barbers.find(b => b.id === app.barberId)?.name || '';
                  const isActionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                  const isReceipt = app.status === 'Finalizado';
                  return (
                    <div
                      key={app.id}
                      className={`dash-timeline-item${isInServiceStatus(app.status) ? ' dash-timeline-item--in-service' : ''}`}
                      onClick={() => (isReceipt ? openReceiptModal(app) : (isActionable ? openActionModal(app) : null))}
                      style={{
                        cursor: (isActionable || isReceipt) ? 'pointer' : 'default',
                        '--timeline-status-color': cfg.color,
                        '--timeline-line-color': cfg.lineColor,
                      }}
                    >
                      <div className="dash-timeline-time">{dateStr}</div>
                      <div className="dash-timeline-dot-col">
                        <div
                          className="dash-timeline-dot"
                          style={{ background: cfg.color, borderColor: 'var(--panel-bg)' }}
                        />
                        {idx < recentActivity.length - 1 && (
                          <div className="dash-timeline-line" style={{ background: cfg.lineColor }} />
                        )}
                      </div>
                      <div className="dash-timeline-content" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <h4 className="dash-timeline-status" style={{ color: cfg.color }}>
                              {cfg.label}
                            </h4>
                            <p>{app.customer} — {app.service}{!isBarber ? ` (${barberName})` : ''}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Col 3: Próximos Agendamentos ─── */}
        <div className="dash-panel dash-panel-upcoming">
          <div className="dash-panel-header">
            <h3>Próximos Agendamentos</h3>
            <button className="dash-icon-btn"><Calendar size={16} /></button>
          </div>
          <div className="dash-panel-body">
            <MiniCalendar focusDate={focusDate} onDateSelect={setFocusDate} />
            {upcoming.length === 0 ? (
              <DashUpcomingEmpty />
            ) : (
              upcoming.map((app) => {
                const barberForApp = barbers.find((b) => b.id === app.barberId);
                const barberIdx = barbers.findIndex((b) => b.id === app.barberId);
                const barberName = barberForApp?.name?.split(' ')[0] || '';
                const normalizedPhone = normalizePhoneForWhatsApp(app.phone);
                const avatarBg = barberIdx >= 0 ? (barberColors[barberIdx % barberColors.length] || '#94a3b8') : '#94a3b8';
                return (
                  <div key={app.id} className="dash-upcoming-item" onClick={() => openActionModal(app)} style={{ cursor: 'pointer' }}>
                    <div
                      className="dash-upcoming-barber-avatar"
                      style={{ background: avatarBg }}
                    >
                      {barberForApp?.foto_perfil ? (
                        <img
                          src={barberForApp.foto_perfil}
                          alt={barberForApp.name ? `Foto de ${barberForApp.name}` : 'Profissional'}
                        />
                      ) : (
                        <span>{(barberForApp?.name || '?').charAt(0)}</span>
                      )}
                    </div>
                    <div className="dash-upcoming-info" style={{ flex: 1 }}>
                      <h4>{app.customer}</h4>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.service || 'Serviço'}</p>
                      <p>{app.time}{!isBarber ? ` — ${barberName}` : ''}</p>
                    </div>
                    <div className="dash-upcoming-right">
                      <div className="dash-upcoming-actions">
                        <button
                          type="button"
                          className={`dash-upcoming-action-btn dash-upcoming-action-btn--start${isInServiceStatus(app.status) ? ' dash-upcoming-action-btn--in-service' : ''}`}
                          title={isInServiceStatus(app.status) ? 'Em atendimento' : 'Iniciar atendimento'}
                          aria-label={
                            isInServiceStatus(app.status)
                              ? `${app.customer} em atendimento`
                              : `Iniciar atendimento de ${app.customer}`
                          }
                          style={{
                            color: IN_SERVICE_COLOR,
                            background: isInServiceStatus(app.status)
                              ? 'rgba(147, 197, 253, 0.35)'
                              : 'rgba(147, 197, 253, 0.22)',
                            border: '1px solid rgba(147, 197, 253, 0.6)',
                          }}
                          onClick={(event) => handleQuickStart(app, event)}
                        >
                          <Play size={13} strokeWidth={2.25} color="currentColor" />
                        </button>
                        <button
                          type="button"
                          className="sloot-circle-action sloot-circle-action--confirm sloot-circle-action--sm"
                          title="Confirmar atendimento"
                          aria-label={`Confirmar atendimento de ${app.customer}`}
                          onClick={(event) => handleQuickConfirm(app, event)}
                        >
                          <CheckCircle size={13} />
                        </button>
                        <button
                          type="button"
                          className="sloot-circle-action sloot-circle-action--cancel-outline sloot-circle-action--sm"
                          title="Cancelar agendamento"
                          aria-label={`Cancelar agendamento de ${app.customer}`}
                          onClick={(event) => handleQuickCancel(app, event)}
                        >
                          <XCircle size={13} />
                        </button>
                      </div>
                      {normalizedPhone && (
                        <button
                          type="button"
                          className="dash-upcoming-wa-btn"
                          title="Confirmar horário por WhatsApp"
                          aria-label={`Confirmar horário com ${app.customer} por WhatsApp`}
                          onClick={(event) => openWhatsAppConfirm(app, event)}
                        >
                          <WhatsAppIcon size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </div>

      {/* ═══════ ACTION MODAL (Pago / Cancelar / Em Progresso) ═══════ */}
      {actionModal.open && actionModal.app && (
        <div className="modal-backdrop">
          <div className="modal-glass-panel scheduler-modal-panel fade-in" style={{ width: '95%', maxWidth: '480px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                {actionModal.step === 'choose'
                  ? 'Ação do Agendamento'
                  : actionModal.step === 'payment'
                    ? 'Check-out — Pagamento'
                    : actionModal.step === 'confirm-start'
                      ? 'Confirmar Início'
                      : 'Confirmar Cancelamento'}
              </h2>
              <button style={{ background: 'none' }} onClick={closeActionModal}><X size={20} /></button>
            </div>

            {/* Appointment Info */}
            <div className="action-modal-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600 }}>{actionModal.app.customer}</span>
                <span style={{ fontWeight: 700, color: 'var(--brand-600)', fontSize: '1.1rem' }}>{formatCurrency(actionModal.app.price)}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {actionModal.app.service} — {actionModal.app.time} — {actionModal.app.date}
              </div>
              <div style={{ marginTop: '6px' }}>
                <span
                  className="action-modal-status-pill"
                  style={{
                    background: actionModal.app.status === 'Em progresso' ? 'rgba(37,99,235,0.1)' : 'rgba(0,0,0,0.05)',
                    color: actionModal.app.status === 'Em progresso' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {actionModal.app.status}
                </span>
              </div>
            </div>

            {/* Change Service Section */}
            {actionModal.step === 'choose' && (
              <div className="action-modal-panel action-modal-panel--dashed">
                <span className="action-modal-panel__title action-modal-panel__title--stack">Trocar Serviço</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="action-modal-field"
                    onChange={(e) => {
                      if (e.target.value) handleChangeService(e.target.value);
                    }}
                    value=""
                  >
                    <option value="">Selecione para trocar...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - R$ {s.price}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step: Choose Action */}
            {actionModal.step === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['Agendado', 'Confirmado'].includes(actionModal.app.status) && (
                  <button
                    type="button"
                    className="action-modal-choice-btn action-modal-choice-btn--start"
                    onClick={() => setActionModal({ ...actionModal, step: 'confirm-start' })}
                  >
                    <Play size={18} /> Iniciar Atendimento
                  </button>
                )}
                <button
                  type="button"
                  className="action-modal-choice-btn action-modal-choice-btn--pay"
                  onClick={() => setActionModal({ ...actionModal, step: 'payment' })}
                >
                  <CheckCircle size={18} aria-hidden /> Marcar como Pago
                </button>
                <button
                  type="button"
                  className="action-modal-choice-btn action-modal-choice-btn--cancel"
                  onClick={() => setActionModal({ ...actionModal, step: 'confirm-cancel' })}
                >
                  <XCircle size={18} aria-hidden /> Cancelar Agendamento
                </button>
              </div>
            )}

            {/* Step: Confirm Start */}
            {actionModal.step === 'confirm-start' && (
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                  Deseja realmente iniciar o atendimento de <strong>{actionModal.app.customer}</strong>?
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setActionModal({ ...actionModal, step: 'choose' })} className="btn-secondary" style={{ flex: 1, padding: '14px' }}>
                    ← Voltar
                  </button>
                  <button onClick={handleMarkInProgress} style={{ flex: 2, padding: '14px', background: 'var(--accent-color)', color: 'var(--accent-text)', borderRadius: '9999px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Play size={18} /> Confirmar Início
                  </button>
                </div>
              </div>
            )}

            {/* Step: Payment Details */}
            {actionModal.step === 'payment' && (
              <div>
                <div className="action-modal-panel">
                  <div className="action-modal-panel__head">
                    <span className="action-modal-panel__title">Composição de Pagamento</span>
                    <button type="button" className="action-modal-panel__chip-btn" onClick={handleAddSplit}>
                      <Plus size={14} aria-hidden /> Dividir
                    </button>
                  </div>
                  <div className="action-modal-panel__stack">
                    {paymentSplits.map((split, index) => (
                      <div key={index} className="fade-in action-modal-panel__split-row">
                        <select className="action-modal-field" value={split.method} onChange={e => handleSplitChange(index, 'method', e.target.value)}>
                          <option value="Pix">Pix</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Cartão de Débito">Cartão de Débito</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>
                        <div className="action-modal-field--amount-wrap">
                          <span className="action-modal-field__currency">R$</span>
                          <input
                            type="number"
                            className="action-modal-field action-modal-field--with-currency"
                            min="0"
                            step="0.01"
                            value={split.amount}
                            onChange={e => handleSplitChange(index, 'amount', e.target.value)}
                          />
                        </div>
                        {paymentSplits.length > 1 && (
                          <button
                            type="button"
                            className="action-modal-remove-row"
                            onClick={() => setPaymentSplits(paymentSplits.filter((_, i) => i !== index))}
                            aria-label="Remover forma de pagamento"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="action-modal-panel">
                  <div className="action-modal-panel__head">
                    <span className="action-modal-panel__title">Produtos no checkout</span>
                    <button type="button" className="action-modal-panel__chip-btn" onClick={handleAddCheckoutProduct}>
                      <Plus size={14} aria-hidden /> Adicionar
                    </button>
                  </div>
                  <div className="action-modal-panel__stack">
                    {checkoutProducts.map((item, index) => (
                      <div key={index} className="action-modal-panel__product-row">
                        <select
                          className="action-modal-field"
                          value={item.productId}
                          onChange={(e) => handleCheckoutProductChange(index, 'productId', e.target.value)}
                        >
                          <option value="">Selecione produto cadastrado</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                              {p.name} - R$ {Number(p.price || 0).toFixed(2)} ({p.stock} un.)
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="action-modal-field action-modal-field--qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleCheckoutProductChange(index, 'quantity', e.target.value)}
                        />
                        {checkoutProducts.length > 1 && (
                          <button
                            type="button"
                            className="action-modal-remove-row"
                            onClick={() => setCheckoutProducts(checkoutProducts.filter((_, i) => i !== index))}
                            aria-label="Remover produto"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Apenas produtos cadastrados podem ser adicionados.
                  </p>
                </div>
                <div className="action-modal-panel action-modal-panel--dashed" style={{ fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Serviço</span>
                    <strong>{formatCurrency(checkoutServiceTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Produtos</span>
                    <strong>{formatCurrency(checkoutProductsTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                    <span style={{ fontWeight: 700 }}>Total checkout</span>
                    <strong style={{ fontSize: '0.9rem' }}>{formatCurrency(checkoutGrandTotal)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setActionModal({ ...actionModal, step: 'choose' })} className="btn-secondary" style={{ flex: 1, padding: '14px' }}>
                    ← Voltar
                  </button>
                  <button className="btn-primary" style={{ flex: 2, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onClick={handleFinalizePayment}>
                    <Banknote size={18} /> Finalizar Recebimento
                  </button>
                </div>
              </div>
            )}

            {/* Step: Confirm Cancel */}
            {actionModal.step === 'confirm-cancel' && (
              <div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                  Tem certeza que deseja cancelar o agendamento de <strong>{actionModal.app.customer}</strong>?
                  Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setActionModal({ ...actionModal, step: 'choose' })} className="btn-secondary" style={{ flex: 1, padding: '14px' }}>
                    ← Voltar
                  </button>
                  <button onClick={handleCancelAppointment} style={{ flex: 2, padding: '14px', background: '#ef4444', color: '#fff', borderRadius: '9999px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <XCircle size={18} /> Confirmar Cancelamento
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {receiptModal.open && receiptModal.app && (
        <div className="modal-backdrop modal-backdrop--elevated">
          <div className="modal-glass-panel scheduler-modal-panel fade-in" style={{ width: '95%', maxWidth: '460px', padding: '1.3rem' }}>
            {(() => {
              const barberName = barbers.find(b => b.id === receiptModal.app.barberId)?.name || 'Profissional';
              const receipt = getReceiptData(receiptModal.app);
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Mini recibo</h3>
                    <button style={{ background: 'none' }} onClick={closeReceiptModal}><X size={18} /></button>
                  </div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>
                    <p style={{ margin: '0 0 4px' }}><strong>Cliente:</strong> {receiptModal.app.customer}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Serviço:</strong> {receiptModal.app.service}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Barbeiro:</strong> {barberName}</p>
                    <p style={{ margin: '0 0 10px' }}><strong>Data/Hora:</strong> {receiptModal.app.date} às {receiptModal.app.time}</p>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border-color)', borderBottom: '1px dashed var(--border-color)', padding: '10px 0', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                      <span>Serviço</span>
                      <strong>{formatCurrency(receipt.serviceTotal)}</strong>
                    </div>
                    <div style={{ marginTop: '8px', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Produtos comprados
                    </div>
                    {receipt.products.length > 0 ? (
                      <>
                        {receipt.products.map((p, idx) => {
                          const unit = Number(p.unitPrice || 0);
                          const qty = Number(p.quantity || 0);
                          const subtotal = p.subtotal ?? (unit * qty);
                          return (
                            <div key={`${p.id}-${idx}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                                <strong>{formatCurrency(subtotal)}</strong>
                              </div>
                              <div style={{ fontSize: '0.74rem' }}>
                                {qty}x {formatCurrency(unit)}
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                          <span>Total em produtos</span>
                          <strong>{formatCurrency(receipt.productsTotal)}</strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nenhum produto comprado.</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginTop: '8px' }}>
                      <strong>Total pago</strong>
                      <strong>{formatCurrency(receipt.totalCheckout)}</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>Forma de pagamento:</strong>
                    {receipt.splits.length > 0 ? (
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        {receipt.splits.map((s, idx) => (
                          <li key={`${s.method}-${idx}`}>{s.method} - {formatCurrency(s.amount)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>Não informado</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════ VENDA MODAL ═══════ */}
      {isSaleModalOpen && (
        <div className="modal-backdrop" onClick={closeSaleModal}>
          <div
            className="modal-glass-panel fade-in scheduler-modal-panel"
            style={{ width: '95%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="booking-reserve-form__title-row">
              <h2 className="booking-reserve-form__title">Venda direta</h2>
              <button type="button" className="booking-reserve-form__close" onClick={closeSaleModal} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="booking-reserve-form" style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Cliente (opcional)
              </label>
              <input
                type="text"
                className="booking-reserve-form__field"
                placeholder="Nome do cliente (opcional)"
                autoComplete="name"
                value={saleForm.customerName}
                onChange={(e) => setSaleForm((prev) => ({ ...prev, customerName: e.target.value }))}
              />

              <select
                className="booking-reserve-form__field"
                value={saleForm.barberId}
                onChange={(e) => setSaleForm((prev) => ({ ...prev, barberId: e.target.value }))}
              >
                <option value="">Profissional (opcional)</option>
                {activeBarbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <div className="action-modal-panel">
                <div className="action-modal-panel__head">
                  <span className="action-modal-panel__title">Itens da venda</span>
                  <button type="button" className="action-modal-panel__chip-btn" onClick={handleAddSaleItem}>
                    <Plus size={14} aria-hidden /> Adicionar
                  </button>
                </div>
                <div className="action-modal-panel__stack">
                  {saleForm.items.map((item, index) => (
                    <div key={index} className="action-modal-panel__product-row">
                      <select
                        className="action-modal-field"
                        value={item.productId}
                        onChange={(e) => handleSaleItemChange(index, 'productId', e.target.value)}
                      >
                        <option value="">Selecione o produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                            {p.name} — R$ {Number(p.price || 0).toFixed(2)} ({p.stock} un.)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="action-modal-field action-modal-field--qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleSaleItemChange(index, 'quantity', e.target.value)}
                      />
                      {saleForm.items.length > 1 && (
                        <button
                          type="button"
                          className="action-modal-remove-row"
                          onClick={() => handleRemoveSaleItem(index)}
                          aria-label="Remover item"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {saleLineItems.length > 0 && (
                <div className="booking-reserve-form__static" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(saleTotal)}</strong>
                </div>
              )}

              <button
                type="button"
                className="btn-primary booking-reserve-form__submit"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                onClick={handleConfirmDirectSale}
                disabled={saleLineItems.length === 0}
              >
                <ShoppingBag size={18} /> Confirmar venda
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-glass-panel fade-in" style={{ width: '95%', maxWidth: '420px', padding: '1.75rem' }}>
            <div className="booking-reserve-form__title-row">
              <h2 className="booking-reserve-form__title">Reservar Horário</h2>
              <button type="button" className="booking-reserve-form__close" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="booking-reserve-form">
              <input
                type="text"
                className="booking-reserve-form__field"
                placeholder="Nome do cliente *"
                autoComplete="name"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
              />
              <input
                type="tel"
                className="booking-reserve-form__field"
                placeholder="Telefone (WhatsApp) *"
                autoComplete="tel"
                inputMode="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <select
                className="booking-reserve-form__field"
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
              >
                <option value="">Serviço *</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R$ {s.price}
                  </option>
                ))}
              </select>
              {isBarber ? (
                <div className="booking-reserve-form__static">
                  Profissional: <strong style={{ color: 'var(--text-primary)' }}>{currentUser.name}</strong>
                </div>
              ) : (
                <select
                  className="booking-reserve-form__field"
                  value={formData.barberId}
                  onChange={(e) => setFormData({ ...formData, barberId: e.target.value })}
                >
                  <option value="">Profissional *</option>
                  {activeBarbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="booking-reserve-form__row">
                <input
                  type="date"
                  lang="pt-BR"
                  className="booking-reserve-form__field"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                <select
                  className="booking-reserve-form__field"
                  value={
                    availableDashboardBookingTimes.length === 0
                      ? ''
                      : availableDashboardBookingTimes.includes(formData.time)
                        ? formData.time
                        : availableDashboardBookingTimes[0]
                  }
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  disabled={availableDashboardBookingTimes.length === 0}
                >
                  {availableDashboardBookingTimes.length === 0 ? (
                    <option value="">Sem horários disponíveis</option>
                  ) : (
                    availableDashboardBookingTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {dashboardBookingBarberId && availableDashboardBookingTimes.length === 0 && (
                <p className="booking-reserve-form__hint">
                  Não há horários livres neste dia para o profissional selecionado.
                </p>
              )}
              <button
                type="button"
                className="btn-primary booking-reserve-form__submit"
                onClick={handleSaveAppointment}
                disabled={
                  !formData.customer.trim() ||
                  String(formData.phone || '').replace(/\D/g, '').length < 8 ||
                  !formData.serviceId ||
                  !formData.barberId ||
                  !formData.time ||
                  availableDashboardBookingTimes.length === 0 ||
                  !availableDashboardBookingTimes.includes(formData.time)
                }
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
