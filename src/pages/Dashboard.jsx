import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Calendar, Clock, X, ShoppingBag, Plus, LayoutGrid, Play, CheckCircle, XCircle } from 'lucide-react';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import AppointmentActionModal from '../components/appointments/AppointmentActionModal';
import CashIndicatorMini from '../components/financev2/CashIndicatorMini';
import OpenCashModal from '../components/financev2/OpenCashModal';
import { useApp } from '../context/AppContext';
import { useAppointmentActions, formatCheckoutCurrency } from '../hooks/useAppointmentActions';
import { filterAvailableBookingTimes, isBookingSlotTaken } from '../utils/bookingAvailability';
import { parseDurationMinutes } from '../utils/barberAvailability';
import { getAppointmentStatusConfig, isInServiceStatus } from '../utils/appointmentStatus';
import { normalizePhoneForWhatsApp } from '../utils/appointmentWhatsApp';
import { STAFF_DASHBOARD_TIME_SLOTS } from '../utils/publicBookingSlots';
import { getStaffBookingFormError } from '../utils/staffBookingForm';
import { showFinanceError, showStaffToast } from '../utils/staffToast';

const EMPTY_DIRECT_SALE = {
  customerName: '',
  barberId: '',
  items: [{ productId: '', quantity: 1 }],
};
import { toIsoLocal, todayIsoLocal, getLocalPeriodRange } from '../utils/dateLocal';
import { computeOccupancyForPeriod } from '../utils/occupancyStats';
import { formatRelativeTime } from '../utils/relativeTime';
import OccupancyGauge from '../components/OccupancyGauge';
import DashUpcomingEmpty from '../components/dashboard/DashUpcomingEmpty';
import { useMediaQuery } from '../hooks/useMediaQuery';

/* ─────────── KPI Card ─────────── */
const KpiCard = ({ label, value, subtitle, stagger }) => (
  <div className={`dash-kpi-card stagger-${stagger}`}>
    <div className="dash-kpi-top">
      <span className="dash-kpi-label">{label}</span>
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
const MOBILE_CALENDAR_DAYS = 28;
const DESKTOP_CALENDAR_DAYS = 7;
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MiniCalendar = ({ focusDate, onDateSelect }) => {
  const isMobileCalendar = useMediaQuery('(max-width: 768px)');
  const activeDayRef = useRef(null);
  const today = new Date();
  const d = new Date(focusDate + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - dayOfWeek);

  const calendarStart = new Date(startOfWeek);
  if (isMobileCalendar) {
    calendarStart.setDate(startOfWeek.getDate() - 7);
  }

  const totalDays = isMobileCalendar ? MOBILE_CALENDAR_DAYS : DESKTOP_CALENDAR_DAYS;

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const dd = new Date(calendarStart);
    dd.setDate(calendarStart.getDate() + i);
    days.push(dd);
  }

  useEffect(() => {
    if (!isMobileCalendar || !activeDayRef.current) return;
    activeDayRef.current.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [focusDate, isMobileCalendar]);

  return (
    <div className="dash-mini-cal">
      <div
        className={`dash-mini-cal-grid${isMobileCalendar ? ' dash-mini-cal-grid--scroll' : ''}`}
        role="list"
        aria-label="Selecionar data"
      >
        {days.map((dd) => {
          const ddStr = toIsoLocal(dd);
          const isActive = ddStr === focusDate;
          const isToday = dd.getDate() === today.getDate() && dd.getMonth() === today.getMonth() && dd.getFullYear() === today.getFullYear();

          return (
            <div
              key={ddStr}
              ref={isActive ? activeDayRef : null}
              className={`dash-mini-cal-col ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => onDateSelect && onDateSelect(ddStr)}
              style={{ cursor: 'pointer' }}
              role="listitem"
              aria-current={isActive ? 'date' : undefined}
              aria-label={`${DAY_LABELS[dd.getDay()]} ${dd.getDate()}`}
            >
              <div className="dash-mini-cal-day-label">{DAY_LABELS[dd.getDay()]}</div>
              <div className="dash-mini-cal-day-num">{dd.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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

const ACTIVITY_FEED_LIMIT = 12;
const ACTIVITY_VISIBLE_ROWS = 5;

function getActivityLabel(status) {
  const s = String(status || '').trim();
  switch (s) {
    case 'Finalizado':
      return 'Atendimento finalizado';
    case 'Em progresso':
    case 'Em atendimento':
      return 'Atendimento iniciado';
    case 'Confirmado':
      return 'Horário confirmado';
    case 'Cancelado':
      return 'Agendamento cancelado';
    case 'Agendado':
      return 'Novo agendamento';
    default:
      return s || 'Atualização';
  }
}

function formatActivitySlot(date, time) {
  if (!date) return time || '';
  const parts = String(date).split('-');
  if (parts.length !== 3) return time ? `${date} ${time}` : date;
  const slot = `${parts[2]}/${parts[1]}${time ? ` às ${time}` : ''}`;
  return slot;
}

/* ─────────── Main Dashboard ─────────── */
const Dashboard = () => {
  const {
    barbers, appointments, services, products,
    addAppointment, sellProduct,
    updateAppointmentStatus, cancelAppointment, currentUser, financeV2,
  } = useApp();

  const todayStr = todayIsoLocal();
  const [focusDate, setFocusDate] = useState(todayStr);
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState(7);
  const [activityTick, setActivityTick] = useState(0);
  const isBarber = currentUser?.role === 'Barbeiro';
  const isGerente = currentUser?.role === 'Gerente';
  const [isOpenCashModal, setIsOpenCashModal] = useState(false);
  const [kpis, setKpis] = useState({ revenue: 0, ticketMedio: 0, byBarber: [], comandaCount: 0 });
  const [kpiTick, setKpiTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActivityTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const dashboardPeriodDates = useMemo(
    () => getLocalPeriodRange(todayStr, dashboardPeriodDays),
    [todayStr, dashboardPeriodDays],
  );

  const periodLabel = getPeriodLabel(dashboardPeriodDays);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ open: false, app: null });

  const appointmentActions = useAppointmentActions({
    services,
    products,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
    financeV2,
  });

  const [formData, setFormData] = useState({
    customer: '', phone: '', serviceId: '', barberId: '', time: '09:00', date: focusDate
  });
  const [bookingFormError, setBookingFormError] = useState(null);
  const [saleForm, setSaleForm] = useState(EMPTY_DIRECT_SALE);
  const [cashBrief, setCashBrief] = useState(null);
  const [openCashOptions, setOpenCashOptions] = useState([]);
  const [saleCashSessionId, setSaleCashSessionId] = useState('');
  const [saleMethod, setSaleMethod] = useState('Pix');

  useEffect(() => {
    let alive = true;
    if (!financeV2?.getCurrentCash) return undefined;
    financeV2.getCurrentCash().then((data) => {
      if (alive) setCashBrief(data.session || null);
    }).catch(() => {});
    financeV2.listCashSessions().then((sessions) => {
      if (!alive) return;
      const open = (sessions || []).filter((s) => s.status === 'OPEN');
      setOpenCashOptions(open);
      if (open.length === 1) setSaleCashSessionId(String(open[0].id));
    }).catch(() => {});
    return () => { alive = false; };
  }, [financeV2, isSaleModalOpen]);

  const activeBarbers = useMemo(
    () => barbers.filter(b => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers]
  );

  useEffect(() => {
    let alive = true;
    if (!financeV2?.getKpis) return undefined;
    financeV2
      .getKpis({
        startDate: dashboardPeriodDates.start,
        endDate: dashboardPeriodDates.end,
      })
      .then((data) => {
        if (!alive || !data) return;
        setKpis({
          revenue: Number(data.revenue || 0),
          ticketMedio: Number(data.ticketMedio || 0),
          byBarber: Array.isArray(data.byBarber) ? data.byBarber : [],
          comandaCount: Number(data.comandaCount || 0),
        });
      })
      .catch(() => {
        if (alive) setKpis({ revenue: 0, ticketMedio: 0, byBarber: [], comandaCount: 0 });
      });
    return () => { alive = false; };
  }, [
    financeV2,
    dashboardPeriodDates.start,
    dashboardPeriodDates.end,
    kpiTick,
    appointments,
  ]);

  const stats = useMemo(() => {
    if (isBarber && currentUser?.id != null) {
      const mine = (kpis.byBarber || []).find((r) => Number(r.barberId) === Number(currentUser.id));
      const revenue = Number(mine?.revenue || 0);
      const count = Number(mine?.count || 0);
      const averageTicket = mine?.ticketMedio != null
        ? Number(mine.ticketMedio)
        : (count > 0 ? revenue / count : 0);
      return { revenue, averageTicket, count };
    }
    return {
      revenue: Number(kpis.revenue || 0),
      averageTicket: Number(kpis.ticketMedio || 0),
      count: Number(kpis.comandaCount || 0),
    };
  }, [kpis, isBarber, currentUser?.id]);

  const ranking = useMemo(() => {
    let targetBarbers = barbers.filter((b) => b.role === 'Barbeiro');
    if (isBarber && currentUser?.id != null) {
      targetBarbers = targetBarbers.filter((b) => Number(b.id) === Number(currentUser.id));
    }
    const byId = new Map((kpis.byBarber || []).map((r) => [Number(r.barberId), r]));
    return targetBarbers
      .map((barber) => {
        const row = byId.get(Number(barber.id));
        return {
          ...barber,
          serviceRevenue: Number(row?.serviceRevenue || 0),
          productRevenue: Number(row?.productRevenue || 0),
          revenue: Number(row?.revenue || 0),
          count: Number(row?.count || 0),
          averageTicket: Number(row?.ticketMedio || 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [barbers, kpis.byBarber, isBarber, currentUser?.id]);

  // Feed ao vivo — independente do seletor de KPIs; só eventos com timestamp local
  const recentActivity = useMemo(() => {
    return [...appointments]
      .filter((a) => Number(a._updatedAtLocal || 0) > 0)
      .sort((a, b) => Number(b._updatedAtLocal) - Number(a._updatedAtLocal))
      .slice(0, ACTIVITY_FEED_LIMIT);
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

  const refreshCashBrief = async () => {
    try {
      const data = await financeV2.getCurrentCash();
      setCashBrief(data.session || null);
      const sessions = await financeV2.listCashSessions();
      const open = (sessions || []).filter((s) => s.status === 'OPEN');
      setOpenCashOptions(open);
      if (open.length === 1) setSaleCashSessionId(String(open[0].id));
      else if (!open.find((s) => String(s.id) === String(saleCashSessionId))) {
        setSaleCashSessionId('');
      }
    } catch {
      /* ignore */
    }
  };

  const promptOpenCashOrFinanceiro = (message) => {
    if (isGerente) {
      showStaffToast(`${message} Abra o caixa para continuar.`, { variant: 'warning' });
      setIsOpenCashModal(true);
      return;
    }
    showFinanceError({ code: 'CASH_REQUIRED', message });
  };

  const handleConfirmDirectSale = async () => {
    if (saleLineItems.length === 0) return;
    if (!saleCashSessionId) {
      if (isGerente && openCashOptions.length === 0) {
        promptOpenCashOrFinanceiro('Nenhum caixa aberto.');
        return;
      }
      alert('Selecione o caixa do dia para registrar a venda.');
      return;
    }

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
    try {
      await financeV2.createDirectSale({
        customerName: saleForm.customerName.trim() || 'Cliente balcão',
        barberId,
        cashSessionId: Number(saleCashSessionId),
        method: saleMethod,
        items: saleLineItems.map((item) => {
          const product = products.find((p) => Number(p.id) === item.productId);
          return {
            itemType: 'PRODUCT',
            name: product?.name || 'Produto',
            quantity: item.quantity,
            unitPrice: Number(product?.price || 0),
            productId: item.productId,
          };
        }),
      });
      await refreshCashBrief();
      setKpiTick((t) => t + 1);
      closeSaleModal();
    } catch (err) {
      if (err?.code === 'CASH_CLOSED' || err?.code === 'CASH_REQUIRED') {
        promptOpenCashOrFinanceiro(err.message);
      } else {
        showFinanceError(err);
      }
    }
  };

  const openActionModal = appointmentActions.openActionModal;

  const openNewAppModal = (barberId = '', time = '09:00') => {
    const defaultBarberId = isBarber ? String(currentUser.id) : String(barberId);
    setFormData({ customer: '', phone: '', serviceId: '', barberId: defaultBarberId, time, date: focusDate });
    setBookingFormError(null);
    setIsModalOpen(true);
  };

  const dashboardBookingBarberId = isBarber ? String(currentUser.id) : formData.barberId;
  const dashboardBookingBarber = useMemo(
    () => barbers.find((b) => String(b.id) === String(dashboardBookingBarberId)) || null,
    [barbers, dashboardBookingBarberId]
  );
  const dashboardBookingDurationMinutes = useMemo(() => {
    const svc = services.find((s) => String(s.id) === String(formData.serviceId));
    return parseDurationMinutes(svc?.duration);
  }, [services, formData.serviceId]);
  const dashboardSlotOpts = useMemo(
    () => ({
      barber: dashboardBookingBarber,
      durationMinutes: dashboardBookingDurationMinutes,
      services,
    }),
    [dashboardBookingBarber, dashboardBookingDurationMinutes, services]
  );

  const availableDashboardBookingTimes = useMemo(
    () =>
      filterAvailableBookingTimes(
        STAFF_DASHBOARD_TIME_SLOTS,
        appointments,
        formData.date,
        dashboardBookingBarberId,
        dashboardSlotOpts
      ),
    [appointments, formData.date, dashboardBookingBarberId, dashboardSlotOpts]
  );

  useEffect(() => {
    if (!isModalOpen) return;
    const list = filterAvailableBookingTimes(
      STAFF_DASHBOARD_TIME_SLOTS,
      appointments,
      formData.date,
      dashboardBookingBarberId,
      dashboardSlotOpts
    );
    setFormData((prev) => {
      if (list.length === 0) {
        return prev.time === '' ? prev : { ...prev, time: '' };
      }
      if (list.includes(prev.time)) return prev;
      return { ...prev, time: list[0] };
    });
  }, [isModalOpen, formData.date, dashboardBookingBarberId, appointments]);

  const handleSaveAppointment = () => {
    const validationError = getStaffBookingFormError({
      customer: formData.customer,
      phone: formData.phone,
      serviceId: formData.serviceId,
      barberId: formData.barberId,
      time: formData.time,
      availableTimes: availableDashboardBookingTimes,
    });
    if (validationError) {
      setBookingFormError(validationError);
      return;
    }
    setBookingFormError(null);
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
    if (
      isBookingSlotTaken(appointments, formData.date, effectiveTime, formData.barberId, {
        durationMinutes: dashboardBookingDurationMinutes,
        services,
      })
    ) {
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
  const formatCurrency = formatCheckoutCurrency;

  const openWhatsAppConfirmHandler = (app, event) => {
    appointmentActions.handleWhatsAppConfirm(app, event);
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

  const { handleQuickStart, handleQuickConfirm, handleQuickCancel } = appointmentActions;
  const getStatusConfig = getAppointmentStatusConfig;

  return (
    <div className="dash-page">
      <div className="dash-page__inner">

      {/* ═══════ HEADER ═══════ */}
      <div className="dash-header">
        <div>
          <h1>{isBarber ? `Meu Dashboard` : 'Dashboard'}</h1>
          <CashIndicatorMini financeV2={financeV2} isGerente={isGerente} className="dash-cash-indicator" />
        </div>
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
          {!cashBrief && isGerente ? (
            <button
              type="button"
              className="dash-action-btn secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setIsOpenCashModal(true)}
            >
              Abrir caixa
            </button>
          ) : null}
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
            subtitle={`Serviços pagos no período + produtos · ${periodLabel}`}
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
                const barFillPct = (barber.revenue / maxRevenue) * 100;
                const barTooltip = `Faturamento: ${formatCurrency(barber.revenue)}`;

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
                    <div className="dash-bar-fill" style={{ width: `${barFillPct}%`, background: barberColors[idx] || '#94a3b8' }} />
                  </div>
                  {isBarber && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{barber.count} atendimentos</span>
                      <span>R$ {(barber.serviceRevenue || 0).toLocaleString('pt-BR')} serviços</span>
                      <span>R$ {(barber.productRevenue || 0).toLocaleString('pt-BR')} produtos</span>
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

        {/* ─── Col 2: Atividade ao vivo ─── */}
        <div className="dash-panel dash-panel-activity">
          <div className="dash-panel-header">
            <div>
              <h3>Atividade ao vivo</h3>
              <p className="dash-panel-subtitle">
                {recentActivity.length > ACTIVITY_VISIBLE_ROWS
                  ? 'Atualiza automaticamente · role para ver mais'
                  : 'Atualiza automaticamente'}
              </p>
            </div>
            <button className="dash-icon-btn" type="button" aria-hidden tabIndex={-1}><LayoutGrid size={16} /></button>
          </div>
          <div className="dash-panel-body">
            {recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                Nenhuma movimentação recente. Confirmações, inícios e pagamentos aparecem aqui.
              </p>
            ) : (
              <div
                className="dash-timeline"
                role="feed"
                aria-label="Atividade ao vivo"
                aria-busy="false"
              >
                {recentActivity.map((app, idx) => {
                  const cfg = getStatusConfig(app.status);
                  const relativeTime = formatRelativeTime(app._updatedAtLocal);
                  const slotLabel = formatActivitySlot(app.date, app.time);
                  const barberName = barbers.find(b => b.id === app.barberId)?.name || '';
                  const isActionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                  const isReceipt = app.status === 'Finalizado';
                  return (
                    <div
                      key={`${app.id}-${app._updatedAtLocal}`}
                      className={`dash-timeline-item${isInServiceStatus(app.status) ? ' dash-timeline-item--in-service' : ''}`}
                      onClick={() => (isReceipt ? openReceiptModal(app) : (isActionable ? openActionModal(app) : null))}
                      style={{
                        cursor: (isActionable || isReceipt) ? 'pointer' : 'default',
                        '--timeline-status-color': cfg.color,
                        '--timeline-line-color': cfg.lineColor,
                      }}
                    >
                      <div className="dash-timeline-time">{relativeTime}</div>
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
                              {getActivityLabel(app.status)}
                            </h4>
                            <p>
                              {app.customer} — {app.service}
                              {slotLabel ? ` · ${slotLabel}` : ''}
                              {!isBarber && barberName ? ` (${barberName})` : ''}
                            </p>
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
              <div className="dash-upcoming-list" role="list" aria-label="Lista de próximos agendamentos">
              {upcoming.map((app) => {
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
                      <p className="dash-upcoming-service">{app.service || 'Serviço'}</p>
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
                          onClick={(event) => handleQuickStart(app, event)}
                        >
                          <Play size={20} strokeWidth={2.25} color="currentColor" />
                        </button>
                        <button
                          type="button"
                          className="sloot-circle-action sloot-circle-action--confirm sloot-circle-action--sm"
                          title="Confirmar atendimento"
                          aria-label={`Confirmar atendimento de ${app.customer}`}
                          onClick={(event) => handleQuickConfirm(app, event)}
                        >
                          <CheckCircle size={20} strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          className="sloot-circle-action sloot-circle-action--cancel-outline sloot-circle-action--sm"
                          title="Cancelar agendamento"
                          aria-label={`Cancelar agendamento de ${app.customer}`}
                          onClick={(event) => handleQuickCancel(app, event)}
                        >
                          <XCircle size={20} strokeWidth={2.25} />
                        </button>
                      </div>
                      {normalizedPhone && (
                        <button
                          type="button"
                          className="dash-upcoming-wa-btn"
                          title="Confirmar horário por WhatsApp"
                          aria-label={`Confirmar horário com ${app.customer} por WhatsApp`}
                          onClick={(event) => openWhatsAppConfirmHandler(app, event)}
                        >
                          <WhatsAppIcon size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {isGerente ? (
        <OpenCashModal
          open={isOpenCashModal}
          onClose={() => setIsOpenCashModal(false)}
          onSuccess={refreshCashBrief}
        />
      ) : null}

      <AppointmentActionModal
        {...appointmentActions}
        isGerente={isGerente}
        services={services}
        products={products}
      />

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

              <select
                className="booking-reserve-form__field"
                value={saleCashSessionId}
                onChange={(e) => setSaleCashSessionId(e.target.value)}
              >
                <option value="">
                  {openCashOptions.length ? 'Selecione o caixa' : 'Nenhum caixa aberto'}
                </option>
                {openCashOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.openedByName || 'Caixa'} · {new Date(s.openedAt).toLocaleString('pt-BR')}
                  </option>
                ))}
              </select>

              <select
                className="booking-reserve-form__field"
                value={saleMethod}
                onChange={(e) => setSaleMethod(e.target.value)}
              >
                {['Pix', 'Dinheiro', 'Cartão', 'Outro'].map((m) => (
                  <option key={m} value={m}>{m}</option>
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
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, customer: e.target.value });
                }}
              />
              <input
                type="tel"
                className="booking-reserve-form__field"
                placeholder="Telefone (WhatsApp) *"
                autoComplete="tel"
                inputMode="tel"
                required
                value={formData.phone}
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, phone: e.target.value });
                }}
              />
              <select
                className="booking-reserve-form__field"
                value={formData.serviceId}
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, serviceId: e.target.value });
                }}
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
                  onChange={(e) => {
                    setBookingFormError(null);
                    setFormData({ ...formData, barberId: e.target.value });
                  }}
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
              {bookingFormError && (
                <p className="booking-reserve-form__error" role="alert">
                  {bookingFormError}
                </p>
              )}
              <button
                type="button"
                className="btn-primary booking-reserve-form__submit"
                onClick={handleSaveAppointment}
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
