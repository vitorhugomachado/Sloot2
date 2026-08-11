import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { todayIsoLocal, formatDateBr } from '../utils/dateLocal';
import {
  money,
  formatWhen,
  downloadCsv,
  comandaSeriesLabel,
  comandaStatusLabel,
  comandaStatusTone,
  comandaBalanceDue,
  itemsSubtotal,
  payableFromForm,
  ModalShell,
  Field,
  EmptyState,
  StatusPill,
  CashCloseReport,
} from '../components/financev2/shared';
import CashStatusBar from '../components/financev2/CashStatusBar';
import OverviewTab from '../components/financev2/OverviewTab';
import SessionDetailModal from '../components/financev2/SessionDetailModal';
import ComandaDetailModal from '../components/financev2/ComandaDetailModal';
import { showFinanceError } from '../utils/staffToast';

/** Abas que mostram KPIs/extrato derivados do ledger. */
const TABS_NEEDING_LEDGER = new Set(['Visão geral', 'Extrato', 'Despesas', 'Receitas']);

const GROUPS = [
  {
    id: 'Visão geral',
    label: 'Visão geral',
    tabs: [{ id: 'Visão geral', label: 'Visão geral' }],
  },
  {
    id: 'Movimento',
    label: 'Movimento',
    tabs: [
      { id: 'Extrato', label: 'Extrato' },
      { id: 'Receitas', label: 'Receitas' },
      { id: 'Despesas', label: 'Despesas' },
    ],
  },
  {
    id: 'Caixa',
    label: 'Caixa',
    tabs: [
      { id: 'Caixas', label: 'Caixa do dia' },
      { id: 'Contas', label: 'Contas' },
    ],
  },
  {
    id: 'Comandas',
    label: 'Comandas',
    tabs: [{ id: 'Comandas', label: 'Comandas' }],
  },
  {
    id: 'Equipe',
    label: 'Equipe',
    tabs: [
      { id: 'Comissões', label: 'Comissões' },
      { id: 'Taxas', label: 'Taxas' },
    ],
  },
  {
    id: 'Relatórios',
    label: 'Relatórios',
    tabs: [
      { id: 'Fluxo', label: 'Fluxo' },
      { id: 'DRE', label: 'DRE' },
      { id: 'Fechamentos', label: 'Fechamento contábil' },
      { id: 'Auditoria', label: 'Auditoria' },
    ],
  },
];

const PAY_METHODS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Outro'];
const CARD_BRANDS_UI = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];

function isCardMethod(method) {
  return /cart[aã]o/i.test(String(method || ''));
}
const PAYOUT_METHODS = ['CAIXA', 'Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Outro'];

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartEnd(ym = monthNow()) {
  const [y, m] = ym.split('-').map(Number);
  const start = `${ym}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

function statusMeta(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PAID':
      return { text: 'Pago', tone: 'ok' };
    case 'OVERDUE':
      return { text: 'Atrasado', tone: 'danger' };
    case 'DUE_WEEK':
      return { text: 'Vence esta semana', tone: 'warn' };
    default:
      return { text: 'Pendente', tone: 'muted' };
  }
}

export default function FinanceV2({ isActive = true }) {
  const { financeV2, currentUser, products, services, businessInfo, barbers, updateService } = useApp();
  const isGerente = currentUser?.role === 'Gerente';

  const initialRange = monthStartEnd();
  const [tab, setTab] = useState('Visão geral');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [q, setQ] = useState('');
  const [heroSearch, setHeroSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [cash, setCash] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [ledger, setLedger] = useState({ summary: {}, entries: [] });
  const [expenses, setExpenses] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [comandaFilter, setComandaFilter] = useState('OPEN');
  const [overviewComandas, setOverviewComandas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flow, setFlow] = useState(null);
  const [flowMonth, setFlowMonth] = useState(monthNow());
  const [expandedCats, setExpandedCats] = useState({});
  const [commissions, setCommissions] = useState({ rows: [], byBarber: [], totals: {} });
  const [commissionPayouts, setCommissionPayouts] = useState([]);
  const [cardFeeRates, setCardFeeRates] = useState([]);
  const [cardFeeBrands, setCardFeeBrands] = useState(CARD_BRANDS_UI);
  const [servicePctDraft, setServicePctDraft] = useState({});
  const [accountBalances, setAccountBalances] = useState(null);
  const [closings, setClosings] = useState([]);
  const [dre, setDre] = useState(null);
  const [dreMonth, setDreMonth] = useState(monthNow());
  const [auditLog, setAuditLog] = useState([]);
  const [kpis, setKpis] = useState(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [closeReport, setCloseReport] = useState(null);
  const [closeCashBlockComandas, setCloseCashBlockComandas] = useState([]);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [comandaDetail, setComandaDetail] = useState(null);

  const categoriesLoadedRef = useRef(false);
  const loadedTabsRef = useRef({ key: '', tabs: new Set() });
  const rangeCacheKey = `${startDate}|${endDate}|${comandaFilter}|${dreMonth}`;

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === 'EXPENSE'),
    [categories],
  );

  const summary = ledger.summary || {};

  const refreshCash = useCallback(async () => {
    const data = await financeV2.getCurrentCash();
    setCash(data.session || null);
  }, [financeV2]);

  const refreshLedger = useCallback(async () => {
    const data = await financeV2.getLedger({ startDate, endDate });
    setLedger(data);
  }, [financeV2, startDate, endDate]);

  const refreshExpenses = useCallback(async () => {
    const data = await financeV2.listExpenses({ startDate, endDate, q, dateType: 'due' });
    setExpenses(data);
  }, [financeV2, startDate, endDate, q]);

  const refreshComandas = useCallback(async () => {
    const data = await financeV2.listComandas({
      status: comandaFilter,
      startDate,
      endDate,
      q,
    });
    setComandas(data);
  }, [financeV2, comandaFilter, startDate, endDate, q]);

  const refreshCommissions = useCallback(async () => {
    const [data, payouts] = await Promise.all([
      financeV2.getCommissions({ startDate, endDate }),
      financeV2.listCommissionPayouts({ startDate, endDate }).catch(() => []),
    ]);
    setCommissions(data);
    setCommissionPayouts(Array.isArray(payouts) ? payouts : []);
  }, [financeV2, startDate, endDate]);

  const refreshTaxas = useCallback(async () => {
    try {
      const data = await financeV2.listCardFees();
      setCardFeeRates(Array.isArray(data?.rates) ? data.rates : []);
      if (Array.isArray(data?.brands) && data.brands.length) setCardFeeBrands(data.brands);
      const draft = {};
      (services || []).forEach((s) => {
        draft[s.id] = String(s.commissionPct ?? 50);
      });
      setServicePctDraft(draft);
    } catch (err) {
      console.error(err);
    }
  }, [financeV2, services]);

  const refreshAccounts = useCallback(async () => {
    const data = await financeV2.getAccountBalances();
    setAccountBalances(data);
  }, [financeV2]);

  const refreshClosings = useCallback(async () => {
    const data = await financeV2.listClosings();
    setClosings(Array.isArray(data) ? data : []);
  }, [financeV2]);

  const refreshAudit = useCallback(async () => {
    if (!isGerente) {
      setAuditLog([]);
      return;
    }
    const data = await financeV2.getAuditLog({ startDate, endDate });
    setAuditLog(Array.isArray(data) ? data : []);
  }, [financeV2, startDate, endDate, isGerente]);

  const refreshKpis = useCallback(async () => {
    const data = await financeV2.getKpis({ startDate, endDate });
    setKpis(data);
  }, [financeV2, startDate, endDate]);

  const refreshOverview = useCallback(async () => {
    const [open, partial] = await Promise.all([
      refreshKpis(),
      financeV2.listComandas({ status: 'OPEN' }),
      financeV2.listComandas({ status: 'PARTIAL' }),
    ]).then(([, o, p]) => [o, p]);
    setOverviewComandas([
      ...(Array.isArray(open) ? open : []),
      ...(Array.isArray(partial) ? partial : []),
    ]);
  }, [financeV2, refreshKpis]);

  const refreshAll = useCallback(async (opts = {}) => {
    const force = Boolean(opts && opts.force);
    setLoading(true);
    try {
      if (loadedTabsRef.current.key !== rangeCacheKey) {
        loadedTabsRef.current = { key: rangeCacheKey, tabs: new Set() };
      }
      const tabAlreadyLoaded = !force && loadedTabsRef.current.tabs.has(tab);

      const tasks = [
        refreshCash(),
        financeV2.listCashSessions().then(setSessions),
      ];

      if (force || !categoriesLoadedRef.current) {
        tasks.push(
          financeV2.listCategories().then((data) => {
            setCategories(Array.isArray(data) ? data : []);
            categoriesLoadedRef.current = true;
          }),
        );
      }

      if (!tabAlreadyLoaded) {
        if (TABS_NEEDING_LEDGER.has(tab)) {
          tasks.push(refreshLedger());
        }
        if (tab === 'Visão geral') tasks.push(refreshOverview());
        else if (tab === 'Extrato') tasks.push(refreshKpis());
        else if (tab === 'Despesas') tasks.push(refreshExpenses());
        else if (tab === 'Comandas') tasks.push(refreshComandas());
        else if (tab === 'Comissões') tasks.push(refreshCommissions());
        else if (tab === 'Taxas') tasks.push(refreshTaxas());
        else if (tab === 'Contas') tasks.push(refreshAccounts());
        else if (tab === 'Fechamentos') tasks.push(refreshClosings());
        else if (tab === 'Auditoria') tasks.push(refreshAudit());
        else if (tab === 'DRE') {
          tasks.push(
            financeV2.getDre({ month: dreMonth }).then(setDre).catch((err) => {
              console.error(err);
            }),
          );
        }
      }

      await Promise.all(tasks);
      loadedTabsRef.current.tabs.add(tab);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    refreshCash,
    refreshLedger,
    refreshExpenses,
    refreshComandas,
    refreshCommissions,
    refreshTaxas,
    refreshAccounts,
    refreshClosings,
    refreshAudit,
    refreshKpis,
    refreshOverview,
    financeV2,
    tab,
    dreMonth,
    rangeCacheKey,
  ]);

  useEffect(() => {
    if (!isActive) return;
    refreshAll();
  }, [isActive, tab, startDate, endDate, comandaFilter, dreMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (type, seed = {}) => {
    setForm(seed);
    setModal(type);
    if (type === 'settle' || type === 'entrada') {
      refreshTaxas().catch(() => {});
    }
  };

  const openCloseCashModal = () => {
    setCloseCashBlockComandas([]);
    refreshOverview().catch(() => {});
    openModal('closeCash', {
      countedCash: cash?.totals?.expectedCash ?? 0,
    });
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
  };

  const handleError = (err) => {
    if (err?.code === 'CASH_CLOSED' || err?.code === 'CASH_REQUIRED' || /caixa/i.test(err?.message || '')) {
      showFinanceError(err, { onCashAction: () => setTab('Caixas') });
      return;
    }
    if (err?.code === 'PERIOD_CLOSED' || err?.code === 'OPEN_COMANDAS') {
      showFinanceError(err);
      return;
    }
    showFinanceError(err);
  };

  const onOpenCash = async () => {
    try {
      await financeV2.openCash({
        openingFloat: Number(form.openingFloat || 0),
        notes: form.notes || '',
        date: form.date || todayIsoLocal(),
      });
      closeModal();
      await refreshCash();
      await financeV2.listCashSessions().then(setSessions);
    } catch (err) {
      handleError(err);
    }
  };

  const onReopenCash = async (sessionId) => {
    if (cash) {
      alert('Já existe um caixa aberto. Feche-o antes de reabrir outro.');
      return;
    }
    const reason = window.prompt('Motivo da reabertura (mínimo 3 caracteres):');
    if (reason == null) return;
    if (String(reason).trim().length < 3) {
      alert('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }
    if (!confirm('Reabrir este caixa? Ele volta a receber movimentos e pagamentos.')) return;
    try {
      await financeV2.reopenCash(sessionId, { reason: String(reason).trim() });
      await refreshCash();
      await financeV2.listCashSessions().then(setSessions);
      setSessionDetail(null);
    } catch (err) {
      handleError(err);
    }
  };

  const onCloseCash = async () => {
    try {
      const closed = await financeV2.closeCash({
        countedCash:
          form.countedCash != null && form.countedCash !== ''
            ? Number(form.countedCash)
            : null,
        notes: form.notes || '',
      });
      setCloseCashBlockComandas([]);
      closeModal();
      setCloseReport(closed);
      await refreshCash();
      await financeV2.listCashSessions().then(setSessions);
    } catch (err) {
      if (err?.code === 'OPEN_COMANDAS') {
        setCloseCashBlockComandas(err.body?.comandas || []);
        showFinanceError(err);
        return;
      }
      handleError(err);
    }
  };

  const onPayExpense = async () => {
    try {
      await financeV2.payExpense(form.id, {
        paymentMethod: form.paymentMethod || 'Dinheiro',
        account: form.account || 'CAIXA',
      });
      closeModal();
      await refreshAll({ force: true });
      await refreshExpenses();
      await refreshCash();
    } catch (err) {
      handleError(err);
    }
  };

  const onUpdateExpense = async () => {
    try {
      await financeV2.updateExpense(form.id, {
        title: form.title,
        amount: Number(form.amount || 0),
        dueDate: form.dueDate,
        competenceDate: form.competenceDate,
        categoryId: form.categoryId || null,
        account: form.account || 'CAIXA',
        supplier: form.supplier || '',
        costCenter: form.costCenter || '',
        invoiceNote: form.invoiceNote || '',
        notes: form.notes || '',
        paymentMethod: form.paymentMethod || '',
      });
      closeModal();
      await refreshExpenses();
      await refreshLedger();
    } catch (err) {
      handleError(err);
    }
  };

  const openComandaDetail = async (id) => {
    try {
      const data = await financeV2.getComanda(id);
      setComandaDetail(data);
    } catch (err) {
      handleError(err);
    }
  };

  const openSessionDetail = async (id) => {
    try {
      const data = await financeV2.getCashSession(id);
      setSessionDetail(data);
    } catch (err) {
      handleError(err);
    }
  };

  const onCreateExpense = async () => {
    try {
      await financeV2.createExpense({
        title: form.title,
        amount: Number(form.amount || 0),
        dueDate: form.dueDate || todayIsoLocal(),
        competenceDate: form.competenceDate || form.dueDate || todayIsoLocal(),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        account: form.account || 'CAIXA',
        payNow: Boolean(form.payNow),
        supplier: form.supplier || '',
        costCenter: form.costCenter || '',
        invoiceNote: form.invoiceNote || '',
        notes: form.notes || '',
        paymentMethod: form.paymentMethod || 'Dinheiro',
      });
      closeModal();
      await refreshAll({ force: true });
      await refreshExpenses();
    } catch (err) {
      handleError(err);
    }
  };

  const onCreateEntrada = async () => {
    try {
      const items = (form.items || [])
        .filter((i) => i.name && Number(i.unitPrice) >= 0)
        .map((i) => {
          const itemType = i.itemType || 'SERVICE';
          if (itemType === 'PRODUCT' && !i.productId) {
            throw Object.assign(new Error(`Escolha o produto no catálogo: ${i.name || 'item'}`), {
              code: 'PRODUCT_REQUIRED',
            });
          }
          const product = products.find((p) => Number(p.id) === Number(i.productId));
          if (itemType === 'PRODUCT' && product && Number(product.stock || 0) < Number(i.quantity || 1)) {
            throw Object.assign(
              new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`),
              { code: 'STOCK_INSUFFICIENT' },
            );
          }
          return {
            itemType,
            name: i.name,
            quantity: Math.max(1, Number(i.quantity || 1)),
            unitPrice: Number(i.unitPrice || 0),
            productId: itemType === 'PRODUCT' ? Number(i.productId) : null,
            serviceId: itemType === 'SERVICE' && i.serviceId ? Number(i.serviceId) : null,
            barberId: i.barberId || null,
          };
        });
      if (!form.customerName?.trim() || !items.length) {
        alert('Informe cliente e ao menos um item do catálogo.');
        return;
      }
      if (form.payNow && !form.cashSessionId) {
        alert('Selecione o caixa do dia para confirmar o recebimento.');
        return;
      }
      const total = itemsSubtotal(items);
      const discount = Math.max(0, Number(form.discountAmount || 0));
      const tip = Math.max(0, Number(form.tipAmount || 0));
      const payable = Math.round((total - discount + tip) * 100) / 100;
      const comanda = await financeV2.createComanda({
        customerName: form.customerName.trim(),
        origin: 'MANUAL',
        total,
        items,
      });
      if (form.payNow) {
        await financeV2.settleComanda(comanda.id, {
          cashSessionId: Number(form.cashSessionId),
          splits: [{ method: form.method || 'Pix', amount: payable }],
          discountAmount: discount,
          tipAmount: tip,
        });
      }
      closeModal();
      await refreshAll({ force: true });
      await refreshComandas();
    } catch (err) {
      handleError(err);
    }
  };

  const onSettleComanda = async () => {
    try {
      if (!form.cashSessionId) {
        alert('Selecione o caixa do dia para confirmar o recebimento.');
        return;
      }
      const payable = payableFromForm(form);
      if (payable < 0) {
        alert('Desconto não pode exceder o total dos itens.');
        return;
      }
      const splits = (form.splits || []).map((s) => {
        const method = s.method || 'Pix';
        const row = {
          method,
          amount: Number(s.amount || 0),
        };
        if (isCardMethod(method)) {
          row.cardBrand = s.cardBrand || 'Visa';
          row.cardKind = s.cardKind
            || (/d[eé]bito/i.test(method) ? 'DEBIT' : 'CREDIT');
        }
        return row;
      });
      for (const s of splits) {
        if (isCardMethod(s.method) && !s.cardBrand) {
          alert('Informe a bandeira do cartão.');
          return;
        }
      }
      const splitSum = Math.round(splits.reduce((s, x) => s + Number(x.amount || 0), 0) * 100) / 100;
      const allowPartial = Boolean(form.allowPartial);
      const target = form.balanceDue != null && form.balanceDue !== ''
        ? Number(form.balanceDue)
        : payable;
      if (!allowPartial && Math.abs(splitSum - target) > 0.02 && Math.abs(splitSum - payable) > 0.02) {
        alert(`A soma das formas (${money(splitSum)}) deve igualar o valor a cobrar (${money(target)}).`);
        return;
      }
      if (allowPartial && splitSum <= 0) {
        alert('Informe um valor maior que zero para o recebimento parcial.');
        return;
      }
      await financeV2.settleComanda(form.comandaId, {
        cashSessionId: Number(form.cashSessionId),
        splits,
        discountAmount: Math.max(0, Number(form.discountAmount || 0)),
        tipAmount: Math.max(0, Number(form.tipAmount || 0)),
        allowPartial,
      });
      closeModal();
      setComandaDetail(null);
      await refreshAll({ force: true });
      await refreshComandas();
    } catch (err) {
      handleError(err);
    }
  };

  const openSettleForComanda = (c, opts = {}) => {
    const meta = c.settlementMeta || {};
    const isPartial = String(c.status || '').toUpperCase() === 'PARTIAL' || opts.remaining;
    const balanceDue = Number(
      opts.balanceDue ?? meta.balanceDue ?? (isPartial ? Math.max(0, Number(c.total || 0) - Number(meta.paidAmount || 0)) : Number(c.total || 0)),
    );
    const amount = isPartial ? balanceDue : Number(c.total || 0);
    openModal('settle', {
      comandaId: c.id,
      total: c.total,
      itemsTotal: c.total,
      discountAmount: isPartial ? Number(meta.discountAmount || 0) : 0,
      tipAmount: isPartial ? Number(meta.tipAmount || 0) : 0,
      customerName: c.customerName,
      cashSessionId: defaultCashSessionId(),
      allowPartial: Boolean(opts.allowPartial) || false,
      balanceDue: isPartial ? balanceDue : null,
      splits: [{ method: 'Pix', amount }],
    });
  };

  const onEditComandaItems = async () => {
    try {
      const items = (form.items || [])
        .filter((i) => i.name && Number(i.unitPrice) >= 0)
        .map((i) => {
          const itemType = i.itemType || 'SERVICE';
          if (itemType === 'PRODUCT' && !i.productId) {
            throw Object.assign(new Error(`Escolha o produto no catálogo: ${i.name || 'item'}`), {
              code: 'PRODUCT_REQUIRED',
            });
          }
          return {
            itemType,
            name: i.name,
            quantity: Math.max(1, Number(i.quantity || 1)),
            unitPrice: Number(i.unitPrice || 0),
            productId: itemType === 'PRODUCT' ? Number(i.productId) : null,
            serviceId: itemType === 'SERVICE' && i.serviceId ? Number(i.serviceId) : null,
            barberId: i.barberId || null,
          };
        });
      if (!items.length) {
        alert('Informe ao menos um item.');
        return;
      }
      await financeV2.updateComandaItems(form.comandaId, {
        customerName: form.customerName,
        items,
      });
      closeModal();
      await refreshComandas();
      await refreshLedger();
    } catch (err) {
      handleError(err);
    }
  };

  const patchComandaItem = (idx, patch) => {
    const items = [...(form.items || [])];
    items[idx] = { ...items[idx], ...patch };
    setForm({ ...form, items, total: itemsSubtotal(items) });
  };

  const applyCatalogSelection = (idx, itemType, catalogId) => {
    const id = Number(catalogId);
    if (itemType === 'PRODUCT') {
      const product = products.find((p) => Number(p.id) === id);
      if (!product) {
        patchComandaItem(idx, { productId: '', name: '', unitPrice: 0, serviceId: null });
        return;
      }
      patchComandaItem(idx, {
        itemType: 'PRODUCT',
        productId: product.id,
        serviceId: null,
        name: product.name,
        unitPrice: Number(product.price || 0),
        quantity: Math.min(
          Math.max(1, Number(form.items?.[idx]?.quantity || 1)),
          Math.max(1, Number(product.stock || 0) || 1),
        ),
      });
      return;
    }
    const service = services.find((s) => Number(s.id) === id);
    if (!service) {
      patchComandaItem(idx, { serviceId: '', name: '', unitPrice: 0, productId: null });
      return;
    }
    patchComandaItem(idx, {
      itemType: 'SERVICE',
      serviceId: service.id,
      productId: null,
      name: service.name,
      unitPrice: Number(service.price || 0),
    });
  };

  const onGenerateFlow = async () => {
    try {
      const data = await financeV2.getCashFlow({
        startMonth: flowMonth,
        endMonth: flowMonth,
        status: 'all',
      });
      setFlow(data);
    } catch (err) {
      handleError(err);
    }
  };

  const filteredEntries = useMemo(
    () =>
      (ledger.entries || []).filter(
        (e) => !q || e.title?.toLowerCase().includes(q.toLowerCase()),
      ),
    [ledger.entries, q],
  );

  const openSessions = useMemo(
    () => (sessions || []).filter((s) => s.status === 'OPEN'),
    [sessions],
  );

  const openBlockingComandas = useMemo(() => {
    const merged = new Map();
    [...(overviewComandas || []), ...(comandas || [])].forEach((c) => {
      const status = String(c?.status || '').toUpperCase();
      if (['OPEN', 'PARTIAL'].includes(status)) merged.set(c.id, c);
    });
    return [...merged.values()];
  }, [overviewComandas, comandas]);

  const blockingComandasForClose = closeCashBlockComandas.length
    ? closeCashBlockComandas
    : openBlockingComandas;

  const cashOptionLabel = (session) => {
    if (!session) return 'Caixa';
    return `${session.openedByName || 'Caixa'} · ${formatWhen(session.openedAt)}`;
  };

  const defaultCashSessionId = () => {
    if (cash?.id) return String(cash.id);
    if (openSessions.length === 1) return String(openSessions[0].id);
    return '';
  };

  const showFilters = ['Extrato', 'Despesas', 'Receitas', 'Comandas', 'Comissões', 'Fechamentos', 'Auditoria'].includes(tab);
  const showKpis = ['Extrato', 'Despesas', 'Receitas'].includes(tab);

  const exportLedgerCsv = () => {
    const rows = filteredEntries;
    const header = ['Data', 'Tipo', 'Título', 'Forma', 'Categoria', 'Valor', 'Status'];
    const lines = [
      header.join(';'),
      ...rows.map((e) =>
        [
          formatDateBr(e.date),
          e.kind === 'IN' ? 'Receita' : 'Despesa',
          `"${String(e.title || '').replace(/"/g, '""')}"`,
          e.paymentMethod || '',
          e.category || '',
          String(e.amount).replace('.', ','),
          e.status || '',
        ].join(';'),
      ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDreCsv = () => {
    if (!dre) return;
    const prev = dre.previousMonth || {};
    const header = ['Indicador', 'Mês atual', 'Mês anterior'];
    const rows = [
      ['Receita bruta', String(dre.revenueGross).replace('.', ','), String(prev.revenueGross ?? '').replace('.', ',')],
      ['Descontos', String(dre.discounts).replace('.', ','), String(prev.discounts ?? '').replace('.', ',')],
      ['Gorjetas', String(dre.tips).replace('.', ','), String(prev.tips ?? '').replace('.', ',')],
      ['Receita líquida', String(dre.revenueNet).replace('.', ','), String(prev.revenueNet ?? '').replace('.', ',')],
      ['Comissões', String(dre.commissions).replace('.', ','), String(prev.commissions ?? '').replace('.', ',')],
      ['Despesas', String(dre.expensesTotal).replace('.', ','), String(prev.expensesTotal ?? '').replace('.', ',')],
      ['Resultado', String(dre.result).replace('.', ','), String(prev.result ?? '').replace('.', ',')],
      ...(dre.expensesByCategory || []).map((c) => [
        `Despesa · ${c.category}`,
        String(c.amount).replace('.', ','),
        '',
      ]),
    ];
    downloadCsv(`dre-${dre.month || dreMonth}.csv`, header, rows);
  };

  const applyHeroSearch = async () => {
    const term = heroSearch.trim();
    setQ(term);
    setTab('Comandas');
    setComandaFilter('OPEN');
    try {
      const data = await financeV2.listComandas({
        status: 'OPEN',
        startDate,
        endDate,
        q: term,
      });
      setComandas(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="finance-page finv2-page">
      <header className="finv2-hero finv2-hero--compact">
        <div className="finv2-hero__copy">
          <p className="finv2-eyebrow">Gestão</p>
          <h1>Financeiro</h1>
        </div>
        <div className="finv2-hero__actions">
          <div className="finv2-search finv2-hero__search">
            <Search size={15} strokeWidth={2} />
            <input
              value={heroSearch}
              onChange={(e) => setHeroSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyHeroSearch();
              }}
              placeholder="Buscar comanda (nº ou cliente)"
            />
          </div>
          <button
            type="button"
            className="finv2-btn finv2-btn--ghost-danger"
            onClick={() =>
              openModal('saida', {
                dueDate: todayIsoLocal(),
                competenceDate: todayIsoLocal(),
                account: 'CAIXA',
                payNow: true,
                paymentMethod: 'Dinheiro',
              })
            }
          >
            <ArrowDownLeft size={16} strokeWidth={2.25} />
            Nova saída
          </button>
          <button
            type="button"
            className="btn-primary finv2-btn-primary"
            onClick={() =>
              openModal('entrada', {
                payNow: true,
                method: 'Pix',
                cashSessionId: defaultCashSessionId(),
                customerName: '',
                discountAmount: 0,
                tipAmount: 0,
                items: [{ itemType: 'SERVICE', serviceId: '', productId: '', name: '', quantity: 1, unitPrice: 0 }],
              })
            }
          >
            <ArrowUpRight size={16} strokeWidth={2.25} />
            Nova entrada
          </button>
        </div>
      </header>

      <CashStatusBar
        cash={cash}
        isGerente={isGerente}
        onOpenCash={() => {
          setTab('Caixas');
          openModal('openCash', { openingFloat: 0, date: todayIsoLocal() });
        }}
        onAdjust={() => openModal('adjust', { type: 'OUT', method: 'Dinheiro' })}
        onCloseCash={openCloseCashModal}
      />

      <nav className="finance-tab-nav finv2-tabs" aria-label="Seções do financeiro">
        {GROUPS.map((g) => {
          const isActive = g.tabs.some((t) => t.id === tab);
          return (
            <button
              key={g.id}
              type="button"
              className={isActive ? 'active' : ''}
              onClick={() => setTab(g.tabs[0].id)}
            >
              {g.label}
              {isActive ? <span className="finv2-tab-underline" /> : null}
            </button>
          );
        })}
      </nav>

      {(() => {
        const activeGroup = GROUPS.find((g) => g.tabs.some((t) => t.id === tab));
        if (!activeGroup || activeGroup.tabs.length < 2) return null;
        return (
          <div className="finv2-subtabs">
            <div className="finv2-segment">
              {activeGroup.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? 'is-active' : ''}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {showFilters && (
        <div className="glass-card finv2-filters">
          <Field label="Data início">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Data fim">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Buscar" full>
            <div className="finv2-search">
              <Search size={15} strokeWidth={2} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Título, cliente ou nº da comanda"
              />
            </div>
          </Field>
          <button
            type="button"
            className="btn-primary finv2-btn-primary finv2-filters__submit"
            onClick={() => refreshAll({ force: true })}
            disabled={loading}
          >
            {loading ? 'Atualizando…' : 'Buscar'}
          </button>
        </div>
      )}

      {showKpis && (
        <div className="dash-kpi-row finv2-kpi-row">
          <div className="dash-kpi-card stagger-1">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Receitas recebidas</span>
            </div>
            <div className="dash-kpi-value">{money(summary.totalReceitas)}</div>
            <div className="dash-kpi-subtitle">Comandas quitadas no período</div>
          </div>
          <div className="dash-kpi-card stagger-2">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Despesas pagas</span>
            </div>
            <div className="dash-kpi-value">{money(summary.totalDespesas)}</div>
            <div className="dash-kpi-subtitle">Saídas confirmadas</div>
          </div>
          <div className="dash-kpi-card stagger-3">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Resultado</span>
            </div>
            <div className="dash-kpi-value">{money(summary.resultado)}</div>
            <div className="dash-kpi-subtitle">Receitas − despesas</div>
          </div>
          <div className="dash-kpi-card stagger-4">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Em aberto</span>
            </div>
            <div className="dash-kpi-value">{money(summary.emAberto)}</div>
            <div className="dash-kpi-subtitle">Pendências + comandas abertas</div>
          </div>
        </div>
      )}

      {tab === 'Extrato' && kpis ? (
        <div className="dash-kpi-row finv2-kpi-row" style={{ marginTop: showKpis ? 0 : undefined }}>
          <div className="dash-kpi-card">
            <div className="dash-kpi-top"><span className="dash-kpi-label">Ticket médio</span></div>
            <div className="dash-kpi-value">{money(kpis.ticketMedio)}</div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-top"><span className="dash-kpi-label">Mix serviço / produto</span></div>
            <div className="dash-kpi-value" style={{ fontSize: '1.15rem' }}>
              {Number(kpis.mixServicePct || 0).toFixed(0)}% / {Number(kpis.mixProductPct || 0).toFixed(0)}%
            </div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-top"><span className="dash-kpi-label">Descontos</span></div>
            <div className="dash-kpi-value">{money(kpis.discountTotal)}</div>
          </div>
          <div className="dash-kpi-card">
            <div className="dash-kpi-top"><span className="dash-kpi-label">Gorjetas</span></div>
            <div className="dash-kpi-value">{money(kpis.tipsTotal)}</div>
          </div>
          {kpis.monthlyRevenueGoal != null ? (
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Meta do mês</span></div>
              <div className="dash-kpi-value" style={{ fontSize: '1.15rem' }}>
                {kpis.goalProgress != null ? `${Number(kpis.goalProgress).toFixed(0)}%` : '—'}
              </div>
              <div className="dash-kpi-subtitle">Meta {money(kpis.monthlyRevenueGoal)}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'Visão geral' && (
        <OverviewTab
          kpis={kpis}
          summary={summary}
          entries={ledger.entries || []}
          openComandas={overviewComandas}
          onOpenComanda={openComandaDetail}
          onGoToComandas={() => {
            setComandaFilter('OPEN');
            setTab('Comandas');
          }}
        />
      )}

      {tab === 'Extrato' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Extrato do período</h3>
            <div className="finv2-inline-actions">
              <span>{filteredEntries.length} lançamentos</span>
              <button type="button" className="finv2-btn" onClick={exportLedgerCsv} disabled={!filteredEntries.length}>
                <Download size={15} /> CSV
              </button>
            </div>
          </div>
          {filteredEntries.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table finv2-table--cards">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Título</th>
                    <th>Forma</th>
                    <th>Categoria</th>
                    <th className="is-right">Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="is-muted" data-label="Data">{formatDateBr(e.date)}</td>
                      <td className="is-strong" data-label="Título">{e.title}</td>
                      <td data-label="Forma">{e.paymentMethod || '—'}</td>
                      <td data-label="Categoria">{e.category}</td>
                      <td
                        className={`is-right is-strong finv2-num ${e.amount < 0 ? 'is-out' : 'is-in'}`}
                        data-label="Valor"
                      >
                        {money(e.amount)}
                      </td>
                      <td data-label="Status">
                        <StatusPill tone="ok">Pago</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem lançamentos" hint="Ajuste o período ou confirme recebimentos nas comandas." />
          )}
        </div>
      )}

      {tab === 'Despesas' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Despesas</h3>
            <div className="finv2-inline-actions">
              {isGerente ? (
                <button
                  type="button"
                  className="finv2-btn"
                  onClick={() => openModal('categories', { name: '', kind: 'EXPENSE' })}
                >
                  Gerenciar categorias
                </button>
              ) : null}
              <button
                type="button"
                className="finv2-btn finv2-btn--ghost-danger"
                onClick={() =>
                  openModal('saida', {
                    dueDate: todayIsoLocal(),
                    competenceDate: todayIsoLocal(),
                    account: 'CAIXA',
                    payNow: true,
                    paymentMethod: 'Dinheiro',
                  })
                }
              >
                <Plus size={15} /> Nova saída
              </button>
            </div>
          </div>
          {expenses.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Título</th>
                    <th>Forma</th>
                    <th>Categoria</th>
                    <th className="is-right">Valor</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => {
                    const st = statusMeta(e.computedStatus || e.status);
                    const unpaid = st.tone !== 'ok';
                    return (
                      <tr key={e.id}>
                        <td className="is-muted">{formatDateBr(e.dueDate || e.date)}</td>
                        <td className="is-strong">{e.title || e.description}</td>
                        <td>{e.paymentMethod || '—'}</td>
                        <td>{e.financeCategory?.name || e.category || '—'}</td>
                        <td className="is-right is-strong is-out">{money(-e.amount)}</td>
                        <td>
                          <StatusPill tone={st.tone}>{st.text}</StatusPill>
                        </td>
                        <td className="is-right">
                          {isGerente ? (
                            <div className="finv2-row-actions">
                              {unpaid ? (
                                <button
                                  type="button"
                                  className="btn-primary finv2-btn-primary finv2-btn-sm"
                                  onClick={() =>
                                    openModal('payExpense', {
                                      id: e.id,
                                      title: e.title || e.description,
                                      amount: e.amount,
                                      paymentMethod: e.paymentMethod || 'Dinheiro',
                                      account: e.account || 'CAIXA',
                                    })
                                  }
                                >
                                  Pagar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="finv2-btn finv2-btn-sm"
                                  onClick={async () => {
                                    if (!confirm('Estornar pagamento desta despesa?')) return;
                                    try {
                                      await financeV2.reverseExpense(e.id);
                                      await refreshExpenses();
                                      await refreshCash();
                                      await refreshLedger();
                                    } catch (err) {
                                      handleError(err);
                                    }
                                  }}
                                >
                                  Estornar
                                </button>
                              )}
                              <button
                                type="button"
                                className="finv2-icon-btn"
                                title="Editar"
                                onClick={() =>
                                  openModal('editExpense', {
                                    id: e.id,
                                    title: e.title || e.description,
                                    amount: e.amount,
                                    dueDate: e.dueDate || e.date || todayIsoLocal(),
                                    competenceDate: e.competenceDate || e.dueDate || e.date || todayIsoLocal(),
                                    categoryId: e.categoryId || '',
                                    account: e.account || 'CAIXA',
                                    supplier: e.supplier || '',
                                    costCenter: e.costCenter || '',
                                    invoiceNote: e.invoiceNote || '',
                                    notes: e.notes || '',
                                    paymentMethod: e.paymentMethod || '',
                                    paid: !unpaid,
                                  })
                                }
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="finv2-icon-btn finv2-icon-btn--danger"
                                title="Excluir"
                                onClick={async () => {
                                  if (!confirm('Excluir despesa?')) return;
                                  try {
                                    await financeV2.deleteExpense(e.id);
                                    await refreshExpenses();
                                    await refreshLedger();
                                  } catch (err) {
                                    handleError(err);
                                  }
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhuma despesa" hint="Use Nova saída para registrar aluguel, luz, produtos…" />
          )}
        </div>
      )}

      {tab === 'Receitas' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Receitas de vendas</h3>
            <span>Comandas quitadas</span>
          </div>
          <ReceitasTable financeV2={financeV2} startDate={startDate} endDate={endDate} q={q} />
        </div>
      )}

      {tab === 'Caixas' && (
        <div className="finv2-stack">
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <div>
                <h3>Caixa atual</h3>
                <p className="finv2-panel__hint">
                  {cash
                    ? `Entradas ${money(cash.totals?.totalIn)} · Saldo ${money(cash.totals?.balance)} · Dinheiro esperado ${money(cash.totals?.expectedCash)}`
                    : 'Nenhuma sessão aberta agora'}
                </p>
              </div>
              {isGerente && (
                <div className="finv2-inline-actions">
                  {!cash ? (
                    <button
                      type="button"
                      className="btn-primary finv2-btn-primary"
                      onClick={() => openModal('openCash', { openingFloat: 0, date: todayIsoLocal() })}
                    >
                      Abrir caixa
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="finv2-btn"
                        onClick={() => openModal('adjust', { type: 'OUT', method: 'Dinheiro' })}
                      >
                        Sangria
                      </button>
                      <button
                        type="button"
                        className="finv2-btn finv2-btn--ghost-danger"
                        onClick={openCloseCashModal}
                      >
                        Fechar caixa
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {cash?.movements?.length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Tipo</th>
                      <th>Método</th>
                      <th>Descrição</th>
                      <th className="is-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cash.movements.map((m) => (
                      <tr key={m.id}>
                        <td className="is-muted">{formatWhen(m.createdAt)}</td>
                        <td>{m.type === 'IN' ? 'Entrada' : 'Saída'}</td>
                        <td>{m.method}</td>
                        <td className="is-strong">{m.description}</td>
                        <td className={`is-right is-strong finv2-num ${m.type === 'IN' ? 'is-in' : 'is-out'}`}>
                          {money(m.type === 'IN' ? m.amount : -m.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Wallet}
                title={cash ? 'Sem movimentos ainda' : 'Caixa fechado'}
                hint={cash ? 'Recebimentos de comandas aparecem aqui.' : 'Abra o caixa para começar o dia.'}
              />
            )}
          </div>

          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Histórico de caixas</h3>
            </div>
            {sessions.length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Abertura</th>
                      <th>Responsável</th>
                      <th>Status</th>
                      <th>Fechamento</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="finv2-row-click" onClick={() => openSessionDetail(s.id)}>
                        <td className="is-muted">{formatWhen(s.openedAt)}</td>
                        <td className="is-strong">{s.openedByName || '—'}</td>
                        <td>
                          <StatusPill tone={s.status === 'OPEN' ? 'ok' : 'muted'}>
                            {s.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                          </StatusPill>
                        </td>
                        <td className="is-muted">{formatWhen(s.closedAt)}</td>
                        <td className="is-right">
                          <div className="finv2-row-actions">
                            {s.status !== 'OPEN' && isGerente && !cash ? (
                              <button
                                type="button"
                                className="btn-primary finv2-btn-primary finv2-btn-sm"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onReopenCash(s.id);
                                }}
                              >
                                Reabrir
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="finv2-icon-btn"
                              title="Ver detalhes"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openSessionDetail(s.id);
                              }}
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem histórico" hint="Sessões fechadas aparecem aqui." />
            )}
          </div>
        </div>
      )}

      {tab === 'Comandas' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Comandas</h3>
            <div className="finv2-segment">
              {[
                { id: 'OPEN', label: 'Abertas' },
                { id: 'PARTIAL', label: 'Parciais' },
                { id: 'QUITADA', label: 'Quitadas' },
                { id: 'CANCELLED', label: 'Canceladas' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={comandaFilter === opt.id ? 'is-active' : ''}
                  onClick={() => setComandaFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {comandas.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table finv2-table--cards">
                <thead>
                  <tr>
                    <th>Comanda</th>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th>Caixa</th>
                    <th>Abertura</th>
                    <th className="is-right">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {comandas.map((c) => {
                    const balanceDue = comandaBalanceDue(c);
                    return (
                      <tr key={c.id}>
                        <td className="is-strong" data-label="Comanda">
                          {comandaSeriesLabel(c)}
                          <div className="is-muted" style={{ fontSize: '0.75rem', fontWeight: 400 }}>
                            #{c.number}
                          </div>
                        </td>
                        <td data-label="Cliente">{c.customerName}</td>
                        <td data-label="Status">
                          <StatusPill tone={comandaStatusTone(c.status)}>
                            {comandaStatusLabel(c.status)}
                          </StatusPill>
                          {String(c.status).toUpperCase() === 'PARTIAL' && balanceDue > 0 ? (
                            <div className="is-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                              Em aberto {money(balanceDue)}
                            </div>
                          ) : null}
                        </td>
                        <td className="is-muted" data-label="Caixa">
                          {c.cashSession
                            ? `${c.cashSession.openedByName || 'Caixa'} · ${formatWhen(c.cashSession.openedAt)}`
                            : c.status === 'OPEN'
                              ? '—'
                              : 'Sem caixa'}
                        </td>
                        <td className="is-muted" data-label="Abertura">{formatWhen(c.openedAt)}</td>
                        <td className="is-right is-strong finv2-num" data-label="Valor">{money(c.total)}</td>
                        <td className="is-right">
                          <div className="finv2-row-actions">
                            <button
                              type="button"
                              className="finv2-icon-btn"
                              title="Detalhes"
                              onClick={() => openComandaDetail(c.id)}
                            >
                              <Eye size={15} />
                            </button>
                            {c.status === 'OPEN' || c.status === 'PARTIAL' ? (
                              <>
                                {c.status === 'OPEN' ? (
                                  <button
                                    type="button"
                                    className="finv2-btn finv2-btn-sm"
                                    onClick={() =>
                                      openModal('editComanda', {
                                        comandaId: c.id,
                                        customerName: c.customerName,
                                        items: (c.items || []).map((i) => ({
                                          itemType: i.itemType || 'SERVICE',
                                          name: i.name,
                                          quantity: i.quantity || 1,
                                          unitPrice: i.unitPrice || 0,
                                          productId: i.productId || '',
                                          serviceId: i.serviceId || '',
                                          barberId: i.barberId || '',
                                        })),
                                      })
                                    }
                                  >
                                    <Pencil size={14} /> Itens
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn-primary finv2-btn-primary finv2-btn-sm"
                                  onClick={() => openSettleForComanda(c, { remaining: c.status === 'PARTIAL' })}
                                >
                                  {c.status === 'PARTIAL' ? 'Receber restante' : 'Confirmar'}
                                </button>
                                {isGerente && c.status === 'OPEN' ? (
                                  <button
                                    type="button"
                                    className="finv2-icon-btn finv2-icon-btn--danger"
                                    title="Cancelar"
                                    onClick={async () => {
                                      if (!confirm('Cancelar esta comanda?')) return;
                                      try {
                                        await financeV2.cancelComanda(c.id);
                                        await refreshComandas();
                                        await refreshLedger();
                                      } catch (err) {
                                        handleError(err);
                                      }
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {c.status === 'QUITADA' && isGerente ? (
                              <button
                                type="button"
                                className="finv2-btn finv2-btn-sm"
                                onClick={async () => {
                                  if (!confirm('Estornar esta comanda? O valor sai do caixa e ela volta a aberta.')) return;
                                  try {
                                    await financeV2.reverseComanda(c.id, { restoreStock: true });
                                    await refreshAll({ force: true });
                                    await refreshComandas();
                                  } catch (err) {
                                    handleError(err);
                                  }
                                }}
                              >
                                Estornar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                comandaFilter === 'OPEN'
                  ? 'Nenhuma comanda aberta'
                  : comandaFilter === 'PARTIAL'
                    ? 'Nenhuma comanda parcial'
                    : comandaFilter === 'CANCELLED'
                      ? 'Nenhuma comanda cancelada'
                      : 'Nenhuma comanda quitada'
              }
              hint="Ao finalizar um atendimento com pagamento, a comanda entra aqui."
            />
          )}
        </div>
      )}

      {tab === 'Comissões' && (
        <div className="finv2-stack">
          <div className="dash-kpi-row finv2-kpi-row">
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Bruto serviços</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalGross)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">A repassar (líq.)</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalBarber)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Taxa cartão</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalCardFee)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Retenção casa</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalHouse)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Já pago</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalPaid)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Em aberto</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalOwed)}</div>
            </div>
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Por profissional</h3>
              <div className="finv2-inline-actions">
                <span>{(commissions.byBarber || []).length} profissionais</span>
                {isGerente ? (
                  <button
                    type="button"
                    className="btn-primary finv2-btn-primary finv2-btn-sm"
                    onClick={() =>
                      openModal('commissionPayout', {
                        barberId: '',
                        amount: '',
                        method: 'CAIXA',
                        periodStart: startDate,
                        periodEnd: endDate,
                        cashSessionId: defaultCashSessionId(),
                      })
                    }
                  >
                    Registrar repasse
                  </button>
                ) : null}
              </div>
            </div>
            {(commissions.byBarber || []).length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th className="is-right">Serviços</th>
                      <th className="is-right">Bruto</th>
                      <th className="is-right">Taxa cartão</th>
                      <th className="is-right">Repasse líq.</th>
                      <th className="is-right">Pago</th>
                      <th className="is-right">Em aberto</th>
                      <th className="is-right">Casa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(commissions.byBarber || []).map((b) => (
                      <tr key={b.barberId || 'none'}>
                        <td className="is-strong">{b.barberName}</td>
                        <td className="is-right">{b.count}</td>
                        <td className="is-right">{money(b.totalGross)}</td>
                        <td className="is-right is-out">{money(b.totalCardFee)}</td>
                        <td className="is-right is-in is-strong">{money(b.totalBarber)}</td>
                        <td className="is-right">{money(b.paid)}</td>
                        <td className="is-right is-strong">{money(b.owed ?? b.due)}</td>
                        <td className="is-right">{money(b.totalHouse)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem comissões no período" hint="Defina a % em Equipe → Taxas ou em Configurações → Serviços." />
            )}
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Repasses recentes</h3>
              <span>{commissionPayouts.length} registros</span>
            </div>
            {commissionPayouts.length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Profissional</th>
                      <th>Período</th>
                      <th>Método</th>
                      <th className="is-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionPayouts.map((p) => (
                      <tr key={p.id}>
                        <td className="is-muted">{formatWhen(p.createdAt || p.paidAt)}</td>
                        <td className="is-strong">{p.barberName || barbers.find((b) => Number(b.id) === Number(p.barberId))?.name || `#${p.barberId}`}</td>
                        <td className="is-muted">
                          {formatDateBr(p.periodStart)} → {formatDateBr(p.periodEnd)}
                        </td>
                        <td>{p.method || '—'}</td>
                        <td className="is-right is-in is-strong">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Nenhum repasse registrado" hint="Use Registrar repasse para lançar pagamentos de comissão." />
            )}
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Detalhe</h3>
            </div>
            {(commissions.rows || []).length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Comanda</th>
                      <th>Cliente</th>
                      <th>Serviço</th>
                      <th>Profissional</th>
                      <th className="is-right">%</th>
                      <th className="is-right">Bruto</th>
                      <th className="is-right">Taxa cartão</th>
                      <th className="is-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(commissions.rows || []).map((r, idx) => (
                      <tr key={`${r.comandaId}-${idx}`}>
                        <td className="is-muted">{r.date}</td>
                        <td>Nº{String(r.comandaNumber).padStart(4, '0')}</td>
                        <td>{r.customerName}</td>
                        <td className="is-strong">{r.itemName}</td>
                        <td>{r.barberName}</td>
                        <td className="is-right">{r.commissionPct}%</td>
                        <td className="is-right">{money(r.gross)}</td>
                        <td className="is-right is-out" title={r.cardFeeLabel || undefined}>
                          {Number(r.cardFeeDebit || 0) > 0 ? money(r.cardFeeDebit) : '—'}
                        </td>
                        <td className="is-right is-in is-strong">{money(r.barberPayout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'Taxas' && (
        <div className="finv2-stack">
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <div>
                <h3>Comissão por serviço</h3>
                <p className="finv2-panel__hint">Percentual que o profissional recebe em cada serviço</p>
              </div>
            </div>
            {(services || []).length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Serviço</th>
                      <th className="is-right">Preço</th>
                      <th className="is-right">% profissional</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(services || []).map((s) => (
                      <tr key={s.id}>
                        <td className="is-strong">{s.name}</td>
                        <td className="is-right">{money(s.price)}</td>
                        <td className="is-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            style={{ width: 88, textAlign: 'right' }}
                            value={servicePctDraft[s.id] ?? String(s.commissionPct ?? 50)}
                            disabled={!isGerente}
                            onChange={(e) =>
                              setServicePctDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="is-right">
                          {isGerente ? (
                            <button
                              type="button"
                              className="finv2-btn finv2-btn-sm"
                              onClick={async () => {
                                try {
                                  await updateService(s.id, {
                                    commissionPct: Number(servicePctDraft[s.id] ?? s.commissionPct ?? 50),
                                  });
                                  alert('Comissão do serviço atualizada.');
                                } catch (err) {
                                  handleError(err);
                                }
                              }}
                            >
                              Salvar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Nenhum serviço" hint="Cadastre serviços em Configurações." />
            )}
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <div>
                <h3>Maquininha</h3>
                <p className="finv2-panel__hint">
                  Taxa por bandeira (débito/crédito). Debitada da comissão do barbeiro no pagamento com cartão.
                </p>
              </div>
            </div>
            {cardFeeRates.length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Bandeira</th>
                      <th>Tipo</th>
                      <th className="is-right">Taxa %</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cardFeeRates.map((rate) => (
                      <tr key={rate.id || `${rate.brand}-${rate.kind}`}>
                        <td className="is-strong">{rate.brand}</td>
                        <td>{rate.kind === 'DEBIT' ? 'Débito' : 'Crédito'}</td>
                        <td className="is-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{ width: 88, textAlign: 'right' }}
                            defaultValue={rate.feePct}
                            disabled={!isGerente}
                            id={`card-fee-${rate.brand}-${rate.kind}`}
                          />
                        </td>
                        <td className="is-right">
                          {isGerente ? (
                            <button
                              type="button"
                              className="finv2-btn finv2-btn-sm"
                              onClick={async () => {
                                const el = document.getElementById(`card-fee-${rate.brand}-${rate.kind}`);
                                const feePct = Number(el?.value ?? rate.feePct);
                                try {
                                  await financeV2.upsertCardFee({
                                    brand: rate.brand,
                                    kind: rate.kind,
                                    feePct,
                                  });
                                  await refreshTaxas();
                                  alert('Taxa da maquininha salva.');
                                } catch (err) {
                                  handleError(err);
                                }
                              }}
                            >
                              Salvar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem taxas cadastradas" hint="Abra esta aba como Gerente para gerar as bandeiras padrão." />
            )}
          </div>
        </div>
      )}

      {tab === 'Fluxo' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <div>
              <h3>Fluxo de caixa</h3>
              <p className="finv2-panel__hint">Árvore por categoria no mês selecionado</p>
            </div>
            {isGerente ? (
              <button
                type="button"
                className="finv2-btn"
                onClick={() => openModal('categories', { name: '', kind: 'EXPENSE' })}
              >
                Gerenciar categorias
              </button>
            ) : null}
          </div>
          <div className="finv2-flow-toolbar">
            <Field label="Mês">
              <input type="month" value={flowMonth} onChange={(e) => setFlowMonth(e.target.value)} />
            </Field>
            <button type="button" className="btn-primary finv2-btn-primary" onClick={onGenerateFlow}>
              Gerar fluxo
            </button>
          </div>
          {flow ? (
            <div className="finv2-flow">
              <FlowBlock
                title="RECEITAS"
                total={flow.receitas?.total}
                categories={flow.receitas?.categories || []}
                expanded={expandedCats}
                setExpanded={setExpandedCats}
                positive
              />
              <FlowBlock
                title="DESPESAS"
                total={flow.despesas?.total}
                categories={flow.despesas?.categories || []}
                expanded={expandedCats}
                setExpanded={setExpandedCats}
              />
            </div>
          ) : (
            <EmptyState title="Gere o fluxo" hint="Escolha o mês e clique em Gerar fluxo." />
          )}
        </div>
      )}

      {tab === 'Contas' && (
        <div className="finv2-stack">
          <div className="dash-kpi-row finv2-kpi-row">
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Saldo Caixa</span></div>
              <div className="dash-kpi-value">{money(accountBalances?.CAIXA)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Saldo Banco</span></div>
              <div className="dash-kpi-value">{money(accountBalances?.BANCO)}</div>
            </div>
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Contas</h3>
              {isGerente ? (
                <button
                  type="button"
                  className="btn-primary finv2-btn-primary"
                  onClick={() =>
                    openModal('transferAccounts', {
                      from: 'CAIXA',
                      to: 'BANCO',
                      amount: '',
                      description: '',
                    })
                  }
                >
                  Transferir
                </button>
              ) : null}
            </div>
            <p className="finv2-panel__hint">
              Saldos consolidados das contas Caixa e Banco. Transferências exigem perfil de gestão.
            </p>
          </div>
        </div>
      )}

      {tab === 'Fechamentos' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Fechamento contábil de período</h3>
            {isGerente ? (
              <button
                type="button"
                className="btn-primary finv2-btn-primary"
                onClick={async () => {
                  if (!confirm(`Fechar o período de ${formatDateBr(startDate)} a ${formatDateBr(endDate)}?`)) return;
                  try {
                    await financeV2.createClosing({ periodStart: startDate, periodEnd: endDate });
                    await refreshClosings();
                    alert('Período fechado com sucesso.');
                  } catch (err) {
                    handleError(err);
                  }
                }}
              >
                Fechar período contábil
              </button>
            ) : null}
          </div>
          {closings.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Fechado em</th>
                    <th>Por</th>
                    <th className="is-right">Receita</th>
                    <th className="is-right">Despesas</th>
                    <th className="is-right">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {closings.map((c) => {
                    const snap = c.snapshot || {};
                    const revenue = snap.comandasQuitada?.total
                      ?? snap.revenue
                      ?? snap.totalReceitas
                      ?? snap.comandas?.total;
                    const exp = snap.expensesPaid?.total
                      ?? snap.expenses?.total
                      ?? snap.totalDespesas
                      ?? snap.expensesTotal;
                    const payoutsTotal = snap.payouts?.total ?? 0;
                    const result = snap.result ?? snap.resultado
                      ?? (revenue != null && exp != null
                        ? Number(revenue) - Number(exp) - Number(payoutsTotal)
                        : null);
                    return (
                      <tr key={c.id}>
                        <td className="is-strong">
                          {formatDateBr(c.periodStart)} → {formatDateBr(c.periodEnd)}
                        </td>
                        <td className="is-muted">{formatWhen(c.createdAt || c.closedAt)}</td>
                        <td>{c.closedByName || '—'}</td>
                        <td className="is-right is-in">{revenue != null ? money(revenue) : '—'}</td>
                        <td className="is-right is-out">{exp != null ? money(exp) : '—'}</td>
                        <td className="is-right is-strong">{result != null ? money(result) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum fechamento" hint="Feche um período para travar lançamentos e gerar o snapshot." />
          )}
        </div>
      )}

      {tab === 'DRE' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <div>
              <h3>DRE</h3>
              <p className="finv2-panel__hint">Demonstrativo do resultado do exercício</p>
            </div>
            <div className="finv2-inline-actions">
              <button type="button" className="finv2-btn" onClick={exportDreCsv} disabled={!dre}>
                <Download size={15} /> CSV
              </button>
            </div>
          </div>
          <div className="finv2-flow-toolbar">
            <Field label="Mês">
              <input type="month" value={dreMonth} onChange={(e) => setDreMonth(e.target.value)} />
            </Field>
            <button
              type="button"
              className="btn-primary finv2-btn-primary"
              onClick={async () => {
                try {
                  const data = await financeV2.getDre({ month: dreMonth });
                  setDre(data);
                } catch (err) {
                  handleError(err);
                }
              }}
            >
              Gerar DRE
            </button>
          </div>
          {dre ? (
            <div className="finv2-form finv2-form--2" style={{ alignItems: 'start' }}>
              <div>
                <h4 style={{ margin: '0 0 8px' }}>Mês {dre.month || dreMonth}</h4>
                <div className="finv2-table-wrap">
                  <table className="finv2-table">
                    <tbody>
                      <tr><td>Receita bruta</td><td className="is-right is-in is-strong">{money(dre.revenueGross)}</td></tr>
                      <tr><td>Descontos</td><td className="is-right is-out">{money(dre.discounts)}</td></tr>
                      <tr><td>Gorjetas</td><td className="is-right is-in">{money(dre.tips)}</td></tr>
                      <tr><td>Receita líquida</td><td className="is-right is-strong">{money(dre.revenueNet)}</td></tr>
                      <tr><td>Comissões</td><td className="is-right is-out">{money(dre.commissions)}</td></tr>
                      <tr><td>Despesas</td><td className="is-right is-out">{money(dre.expensesTotal)}</td></tr>
                      <tr><td className="is-strong">Resultado</td><td className="is-right is-strong">{money(dre.result)}</td></tr>
                    </tbody>
                  </table>
                </div>
                {(dre.expensesByCategory || []).length ? (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Despesas por categoria</h4>
                    <div className="finv2-table-wrap">
                      <table className="finv2-table">
                        <thead>
                          <tr>
                            <th>Categoria</th>
                            <th className="is-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dre.expensesByCategory.map((c) => (
                            <tr key={c.category}>
                              <td>{c.category}</td>
                              <td className="is-right is-out">{money(c.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
              {dre.previousMonth ? (
                <div>
                  <h4 style={{ margin: '0 0 8px' }}>Mês anterior ({dre.previousMonth.month})</h4>
                  <div className="finv2-table-wrap">
                    <table className="finv2-table">
                      <tbody>
                        <tr><td>Receita bruta</td><td className="is-right is-in">{money(dre.previousMonth.revenueGross)}</td></tr>
                        <tr><td>Descontos</td><td className="is-right is-out">{money(dre.previousMonth.discounts)}</td></tr>
                        <tr><td>Gorjetas</td><td className="is-right is-in">{money(dre.previousMonth.tips)}</td></tr>
                        <tr><td>Receita líquida</td><td className="is-right is-strong">{money(dre.previousMonth.revenueNet)}</td></tr>
                        <tr><td>Comissões</td><td className="is-right is-out">{money(dre.previousMonth.commissions)}</td></tr>
                        <tr><td>Despesas</td><td className="is-right is-out">{money(dre.previousMonth.expensesTotal)}</td></tr>
                        <tr><td className="is-strong">Resultado</td><td className="is-right is-strong">{money(dre.previousMonth.result)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="Gere o DRE" hint="Escolha o mês e clique em Gerar DRE." />
          )}
        </div>
      )}

      {tab === 'Auditoria' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Auditoria</h3>
            <span>{isGerente ? `${auditLog.length} eventos` : ''}</span>
          </div>
          {!isGerente ? (
            <EmptyState title="Apenas gestão" hint="O log de auditoria fica disponível para o perfil Gerente." />
          ) : auditLog.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Entidade</th>
                    <th>Id</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row) => (
                    <tr key={row.id}>
                      <td className="is-muted">{formatWhen(row.createdAt)}</td>
                      <td>{row.userName || '—'}</td>
                      <td className="is-strong">{row.action}</td>
                      <td>{row.entity || '—'}</td>
                      <td className="is-muted">{row.entityId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem eventos" hint="Ajuste o período para ver o histórico de ações." />
          )}
        </div>
      )}

      {modal === 'openCash' && (
        <ModalShell
          title="Abrir caixa"
          subtitle="Escolha a data do caixa e, se quiser, informe o dinheiro na gaveta para conferência no fechamento"
          onClose={closeModal}
        >
          <div className="finv2-form">
            <Field label="Data do caixa" full>
              <input
                type="date"
                value={form.date || todayIsoLocal()}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Dinheiro na gaveta (R$)" full>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.openingFloat ?? 0}
                onChange={(e) => setForm({ ...form, openingFloat: e.target.value })}
                placeholder="Ex: 50,00 (troco)"
              />
              <p className="finv2-open-cash-modal__note">
                Usado na conferência ao fechar o caixa. Deixe <strong>0</strong> se a gaveta está vazia.
              </p>
            </Field>
            <Field label="Observações" full>
              <textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onOpenCash}>
              Abrir caixa
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'closeCash' && (
        <ModalShell title="Fechar caixa do dia" subtitle={`Esperado em dinheiro: ${money(cash?.totals?.expectedCash)}`} onClose={closeModal}>
          {blockingComandasForClose.length > 0 ? (
            <div className="action-modal-cash-warning">
              <p>
                <strong>Não é possível fechar o caixa.</strong> Existem comandas abertas ou parciais.
                Quite ou cancele antes de continuar.
              </p>
              <ul>
                {blockingComandasForClose.map((c) => (
                  <li key={c.id}>
                    Nº{String(c.number).padStart(4, '0')} · {c.customerName || '—'} (
                    {comandaStatusLabel(c.status)})
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="action-modal-panel__chip-btn"
                onClick={() => {
                  closeModal();
                  setComandaFilter('OPEN');
                  setTab('Comandas');
                }}
              >
                Ir para Comandas
              </button>
            </div>
          ) : null}
          <div className="finv2-form">
            <Field label="Dinheiro contado (R$)" full>
              <input
                type="number"
                step="0.01"
                value={form.countedCash ?? ''}
                onChange={(e) => setForm({ ...form, countedCash: e.target.value })}
              />
            </Field>
            <Field label="Observações" full>
              <textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onCloseCash}
              disabled={blockingComandasForClose.length > 0}
            >
              Fechar caixa
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'adjust' && (
        <ModalShell title="Sangria / suprimento" onClose={closeModal}>
          <div className="finv2-form finv2-form--2">
            <Field label="Tipo">
              <select
                value={form.type || 'OUT'}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="OUT">Sangria (saída)</option>
                <option value="IN">Suprimento (entrada)</option>
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Descrição" full>
              <input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  await financeV2.createCashMovement({
                    type: form.type || 'OUT',
                    amount: Number(form.amount || 0),
                    method: 'Dinheiro',
                    description:
                      form.description || (form.type === 'IN' ? 'Suprimento' : 'Sangria'),
                  });
                  closeModal();
                  await refreshCash();
                } catch (err) {
                  handleError(err);
                }
              }}
            >
              Lançar
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'saida' && (
        <ModalShell
          title="Registrar saída"
          subtitle="Despesa com opção de pagar no caixa"
          onClose={closeModal}
          wide
        >
          <div className="finv2-form finv2-form--2">
            <Field label="Título" full>
              <input
                value={form.title || ''}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Aluguel, luz, contabilidade"
              />
            </Field>
            <Field label="Categoria">
              <select
                value={form.categoryId || ''}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Selecione…</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Vencimento">
              <input
                type="date"
                value={form.dueDate || ''}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
            <Field label="Competência">
              <input
                type="date"
                value={form.competenceDate || ''}
                onChange={(e) => setForm({ ...form, competenceDate: e.target.value })}
              />
            </Field>
            <Field label="Conta">
              <select
                value={form.account || 'CAIXA'}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
              >
                <option value="CAIXA">Caixa</option>
                <option value="OTHER">Outro</option>
              </select>
            </Field>
            <Field label="Fornecedor">
              <input
                value={form.supplier || ''}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </Field>
            <Field label="Centro de custo" full>
              <input
                value={form.costCenter || ''}
                onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
              />
            </Field>
            <Field label="Nota fiscal" full>
              <input
                value={form.invoiceNote || ''}
                onChange={(e) => setForm({ ...form, invoiceNote: e.target.value })}
              />
            </Field>
            <Field label="Observações" full>
              <textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <label className="finv2-check">
            <input
              type="checkbox"
              checked={Boolean(form.payNow)}
              onChange={(e) => setForm({ ...form, payNow: e.target.checked })}
            />
            <span>Pagar agora (lança no caixa se a conta for Caixa)</span>
          </label>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onCreateExpense}>
              Salvar saída
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'entrada' && (
        <ModalShell title="Nova entrada" subtitle="Comanda com itens do catálogo" onClose={closeModal} wide>
          <div className="finv2-form">
            <Field label="Cliente" full>
              <input
                value={form.customerName || ''}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </Field>
          </div>
          <div className="finv2-settle-list">
            {(form.items || []).map((item, idx) => {
              const itemType = item.itemType || 'SERVICE';
              const product = products.find((p) => Number(p.id) === Number(item.productId));
              return (
                <div key={idx} className="finv2-form finv2-form--2">
                  <Field label="Tipo">
                    <select
                      value={itemType}
                      onChange={(e) =>
                        patchComandaItem(idx, {
                          itemType: e.target.value,
                          productId: '',
                          serviceId: '',
                          name: '',
                          unitPrice: 0,
                        })
                      }
                    >
                      <option value="SERVICE">Serviço</option>
                      <option value="PRODUCT">Produto</option>
                    </select>
                  </Field>
                  <Field label={itemType === 'PRODUCT' ? 'Produto' : 'Serviço'}>
                    {itemType === 'PRODUCT' ? (
                      <select
                        value={item.productId || ''}
                        onChange={(e) => applyCatalogSelection(idx, 'PRODUCT', e.target.value)}
                      >
                        <option value="">Selecione o produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={Number(p.stock || 0) <= 0}>
                            {p.name} · est. {p.stock ?? 0} · {money(p.price)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={item.serviceId || ''}
                        onChange={(e) => applyCatalogSelection(idx, 'SERVICE', e.target.value)}
                      >
                        <option value="">Selecione o serviço</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {money(s.price)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Qtd">
                    <input
                      type="number"
                      min="1"
                      max={itemType === 'PRODUCT' ? Math.max(1, Number(product?.stock || 1)) : undefined}
                      value={item.quantity || 1}
                      onChange={(e) => patchComandaItem(idx, { quantity: e.target.value })}
                    />
                  </Field>
                  <Field label="Unitário">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice || 0}
                      onChange={(e) => patchComandaItem(idx, { unitPrice: e.target.value })}
                    />
                  </Field>
                  {itemType === 'PRODUCT' && product ? (
                    <p className="finv2-field__label" style={{ gridColumn: '1 / -1', margin: 0 }}>
                      Estoque disponível: {product.stock ?? 0}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="finv2-btn finv2-btn--block"
            onClick={() =>
              setForm({
                ...form,
                items: [
                  ...(form.items || []),
                  { itemType: 'SERVICE', serviceId: '', productId: '', name: '', quantity: 1, unitPrice: 0 },
                ],
              })
            }
          >
            <Plus size={15} /> Item
          </button>
          <div className="finv2-form finv2-form--2" style={{ marginTop: 12 }}>
            <Field label="Desconto (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.discountAmount || 0}
                onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
              />
            </Field>
            <Field label="Gorjeta (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.tipAmount || 0}
                onChange={(e) => setForm({ ...form, tipAmount: e.target.value })}
              />
            </Field>
          </div>
          <p className="finv2-field__label" style={{ marginTop: 8 }}>
            Subtotal {money(itemsSubtotal(form.items))} · a cobrar{' '}
            <strong>{money(payableFromForm({ ...form, total: itemsSubtotal(form.items) }))}</strong>
          </p>
          <label className="finv2-check">
            <input
              type="checkbox"
              checked={Boolean(form.payNow)}
              onChange={(e) =>
                setForm({
                  ...form,
                  payNow: e.target.checked,
                  cashSessionId: e.target.checked
                    ? form.cashSessionId || defaultCashSessionId()
                    : form.cashSessionId,
                })
              }
            />
            <span>Confirmar recebimento agora</span>
          </label>
          {form.payNow ? (
            <>
              <Field label="Caixa do dia" full>
                <select
                  value={form.cashSessionId || ''}
                  onChange={(e) => setForm({ ...form, cashSessionId: e.target.value })}
                >
                  <option value="">
                    {openSessions.length ? 'Selecione o caixa' : 'Nenhum caixa aberto'}
                  </option>
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {cashOptionLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Forma de pagamento" full>
                <select
                  value={form.method || 'Pix'}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onCreateEntrada}>
              Salvar
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'settle' && (
        <ModalShell
          title="Confirmar recebimento"
          subtitle={`${form.customerName || 'Cliente'} · itens ${money(form.itemsTotal ?? form.total)} · a cobrar ${money(
            form.balanceDue != null ? form.balanceDue : payableFromForm(form),
          )}`}
          onClose={closeModal}
        >
          <Field label="Caixa do dia" full>
            <select
              value={form.cashSessionId || ''}
              onChange={(e) => setForm({ ...form, cashSessionId: e.target.value })}
            >
              <option value="">
                {openSessions.length ? 'Selecione o caixa' : 'Nenhum caixa aberto'}
              </option>
              {openSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {cashOptionLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <label className="finv2-check">
            <input
              type="checkbox"
              checked={Boolean(form.allowPartial)}
              onChange={(e) => {
                const allowPartial = e.target.checked;
                const next = { ...form, allowPartial };
                if (!allowPartial && form.balanceDue == null) {
                  const payable = payableFromForm(next);
                  const splits = [...(form.splits || [])];
                  if (splits.length === 1) splits[0] = { ...splits[0], amount: payable };
                  next.splits = splits;
                }
                setForm(next);
              }}
            />
            <span>Recebimento parcial (fiado)</span>
          </label>
          {!form.balanceDue ? (
            <div className="finv2-form finv2-form--2">
              <Field label="Desconto (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discountAmount || 0}
                  disabled={Boolean(form.allowPartial)}
                  onChange={(e) => {
                    const discountAmount = e.target.value;
                    const next = { ...form, discountAmount };
                    const payable = payableFromForm(next);
                    const splits = [...(form.splits || [])];
                    if (splits.length === 1 && !form.allowPartial) {
                      splits[0] = { ...splits[0], amount: payable };
                    }
                    setForm({ ...next, splits });
                  }}
                />
              </Field>
              <Field label="Gorjeta (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tipAmount || 0}
                  disabled={Boolean(form.allowPartial)}
                  onChange={(e) => {
                    const tipAmount = e.target.value;
                    const next = { ...form, tipAmount };
                    const payable = payableFromForm(next);
                    const splits = [...(form.splits || [])];
                    if (splits.length === 1 && !form.allowPartial) {
                      splits[0] = { ...splits[0], amount: payable };
                    }
                    setForm({ ...next, splits });
                  }}
                />
              </Field>
            </div>
          ) : (
            <p className="finv2-panel__hint" style={{ margin: '8px 0' }}>
              Saldo em aberto: <strong>{money(form.balanceDue)}</strong>
            </p>
          )}
          <div className="finv2-settle-list">
            {(form.splits || []).map((split, idx) => (
              <div key={idx} className="finv2-stack" style={{ gap: 8 }}>
                <div className="finv2-form finv2-form--2">
                  <Field label="Forma">
                    <select
                      value={split.method}
                      onChange={(e) => {
                        const method = e.target.value;
                        const splits = [...form.splits];
                        const next = { ...splits[idx], method };
                        if (isCardMethod(method)) {
                          next.cardKind = /d[eé]bito/i.test(method) ? 'DEBIT' : 'CREDIT';
                          next.cardBrand = next.cardBrand || 'Visa';
                        } else {
                          delete next.cardBrand;
                          delete next.cardKind;
                          delete next.feePct;
                          delete next.feeAmount;
                        }
                        splits[idx] = next;
                        setForm({ ...form, splits });
                      }}
                    >
                      {PAY_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor">
                    <input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => {
                        const splits = [...form.splits];
                        splits[idx] = { ...splits[idx], amount: e.target.value };
                        setForm({ ...form, splits });
                      }}
                    />
                  </Field>
                </div>
                {isCardMethod(split.method) ? (
                  <div className="finv2-form finv2-form--2">
                    <Field label="Bandeira">
                      <select
                        value={split.cardBrand || 'Visa'}
                        onChange={(e) => {
                          const splits = [...form.splits];
                          splits[idx] = { ...splits[idx], cardBrand: e.target.value };
                          setForm({ ...form, splits });
                        }}
                      >
                        {(cardFeeBrands.length ? cardFeeBrands : CARD_BRANDS_UI).map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Taxa estimada">
                      <input
                        type="text"
                        readOnly
                        value={(() => {
                          const kind = split.cardKind
                            || (/d[eé]bito/i.test(split.method) ? 'DEBIT' : 'CREDIT');
                          const brand = split.cardBrand || 'Visa';
                          const rate = cardFeeRates.find(
                            (r) => r.brand === brand && r.kind === kind,
                          );
                          const pct = Number(rate?.feePct || 0);
                          const fee = Math.round(Number(split.amount || 0) * (pct / 100) * 100) / 100;
                          return `${pct}% → ${money(fee)} (debita da comissão)`;
                        })()}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="finv2-btn finv2-btn--block"
            onClick={() =>
              setForm({
                ...form,
                splits: [...(form.splits || []), { method: 'Pix', amount: 0 }],
              })
            }
          >
            <Plus size={15} /> Forma de pagamento
          </button>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onSettleComanda}>
              {form.allowPartial || form.balanceDue != null ? 'Registrar recebimento' : 'Finalizar e salvar'}
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'editComanda' && (
        <ModalShell
          title="Editar itens da comanda"
          subtitle={form.customerName || 'Cliente'}
          onClose={closeModal}
          wide
        >
          <div className="finv2-settle-list">
            {(form.items || []).map((item, idx) => {
              const itemType = item.itemType || 'SERVICE';
              const product = products.find((p) => Number(p.id) === Number(item.productId));
              return (
                <div key={idx} className="finv2-form finv2-form--2">
                  <Field label="Tipo">
                    <select
                      value={itemType}
                      onChange={(e) =>
                        patchComandaItem(idx, {
                          itemType: e.target.value,
                          productId: '',
                          serviceId: '',
                          name: '',
                          unitPrice: 0,
                        })
                      }
                    >
                      <option value="SERVICE">Serviço</option>
                      <option value="PRODUCT">Produto</option>
                    </select>
                  </Field>
                  <Field label={itemType === 'PRODUCT' ? 'Produto' : 'Serviço'}>
                    {itemType === 'PRODUCT' ? (
                      <select
                        value={item.productId || ''}
                        onChange={(e) => applyCatalogSelection(idx, 'PRODUCT', e.target.value)}
                      >
                        <option value="">Selecione o produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · est. {p.stock ?? 0} · {money(p.price)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={item.serviceId || ''}
                        onChange={(e) => applyCatalogSelection(idx, 'SERVICE', e.target.value)}
                      >
                        <option value="">Selecione o serviço</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {money(s.price)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="Qtd">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || 1}
                      onChange={(e) => patchComandaItem(idx, { quantity: e.target.value })}
                    />
                  </Field>
                  <Field label="Unitário">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice || 0}
                      onChange={(e) => patchComandaItem(idx, { unitPrice: e.target.value })}
                    />
                  </Field>
                  {itemType === 'PRODUCT' && product ? (
                    <p className="finv2-field__label" style={{ gridColumn: '1 / -1', margin: 0 }}>
                      Estoque disponível: {product.stock ?? 0}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="finv2-btn finv2-btn--block"
            onClick={() =>
              setForm({
                ...form,
                items: [
                  ...(form.items || []),
                  { itemType: 'SERVICE', serviceId: '', productId: '', name: '', quantity: 1, unitPrice: 0 },
                ],
              })
            }
          >
            <Plus size={15} /> Item
          </button>
          <p className="finv2-field__label" style={{ marginTop: 8 }}>
            Total: <strong>{money(itemsSubtotal(form.items))}</strong>
          </p>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={onEditComandaItems}>
              Salvar itens
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'payExpense' && (
        <ModalShell
          title="Pagar despesa"
          subtitle={`${form.title || ''} · ${money(form.amount)}`}
          onClose={closeModal}
        >
          <div className="finv2-form finv2-form--2">
            <Field label="Forma de pagamento">
              <select
                value={form.paymentMethod || 'Dinheiro'}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Conta">
              <select
                value={form.account || 'CAIXA'}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
              >
                <option value="CAIXA">Caixa</option>
                <option value="OTHER">Outro</option>
              </select>
            </Field>
          </div>
          <p className="finv2-panel__hint" style={{ marginTop: 12 }}>
            Se a conta for Caixa, o valor sai do caixa aberto agora.
          </p>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={onPayExpense}>Confirmar pagamento</button>
          </div>
        </ModalShell>
      )}

      {modal === 'editExpense' && (
        <ModalShell title="Editar despesa" onClose={closeModal} wide>
          <div className="finv2-form finv2-form--2">
            <Field label="Título" full>
              <input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <select value={form.categoryId || ''} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Selecione…</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                step="0.01"
                value={form.amount || ''}
                disabled={Boolean(form.paid)}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Vencimento">
              <input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
            <Field label="Competência">
              <input type="date" value={form.competenceDate || ''} onChange={(e) => setForm({ ...form, competenceDate: e.target.value })} />
            </Field>
            <Field label="Fornecedor">
              <input value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <Field label="Centro de custo">
              <input value={form.costCenter || ''} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} />
            </Field>
            <Field label="Observações" full>
              <textarea rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={onUpdateExpense}>Salvar</button>
          </div>
        </ModalShell>
      )}

      {modal === 'categories' && (
        <ModalShell title="Gerenciar categorias" subtitle="Crie ou remova categorias financeiras" onClose={closeModal}>
          <div className="finv2-form finv2-form--2">
            <Field label="Nome" full>
              <input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Aluguel, Produtos…"
              />
            </Field>
            <Field label="Tipo">
              <select
                value={form.kind || 'EXPENSE'}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
              </select>
            </Field>
          </div>
          <div className="finv2-modal__actions" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  if (!form.name?.trim()) {
                    alert('Informe o nome da categoria.');
                    return;
                  }
                  await financeV2.createCategory({ name: form.name.trim(), kind: form.kind || 'EXPENSE' });
                  const cats = await financeV2.listCategories();
                  setCategories(cats);
                  setForm({ ...form, name: '' });
                } catch (err) {
                  handleError(err);
                }
              }}
            >
              Criar
            </button>
          </div>
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="is-strong">{c.name}</td>
                    <td>{c.kind === 'INCOME' ? 'Receita' : 'Despesa'}</td>
                    <td className="is-right">
                      <button
                        type="button"
                        className="finv2-icon-btn finv2-icon-btn--danger"
                        title="Excluir"
                        onClick={async () => {
                          if (!confirm(`Excluir categoria "${c.name}"?`)) return;
                          try {
                            await financeV2.deleteCategory(c.id);
                            setCategories(await financeV2.listCategories());
                          } catch (err) {
                            handleError(err);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Fechar</button>
          </div>
        </ModalShell>
      )}

      {modal === 'transferAccounts' && (
        <ModalShell title="Transferir entre contas" onClose={closeModal}>
          <div className="finv2-form finv2-form--2">
            <Field label="De">
              <select value={form.from || 'CAIXA'} onChange={(e) => setForm({ ...form, from: e.target.value })}>
                <option value="CAIXA">Caixa</option>
                <option value="BANCO">Banco</option>
              </select>
            </Field>
            <Field label="Para">
              <select value={form.to || 'BANCO'} onChange={(e) => setForm({ ...form, to: e.target.value })}>
                <option value="CAIXA">Caixa</option>
                <option value="BANCO">Banco</option>
              </select>
            </Field>
            <Field label="Valor (R$)" full>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Descrição" full>
              <input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Depósito bancário"
              />
            </Field>
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  await financeV2.transferAccounts({
                    from: form.from || 'CAIXA',
                    to: form.to || 'BANCO',
                    amount: Number(form.amount || 0),
                    description: form.description || '',
                  });
                  closeModal();
                  await refreshAccounts();
                  await refreshCash();
                  await refreshLedger();
                } catch (err) {
                  handleError(err);
                }
              }}
            >
              Transferir
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'commissionPayout' && (
        <ModalShell title="Registrar repasse" subtitle="Pagamento de comissão ao profissional" onClose={closeModal}>
          <div className="finv2-form finv2-form--2">
            <Field label="Profissional" full>
              <select
                value={form.barberId || ''}
                onChange={(e) => setForm({ ...form, barberId: e.target.value })}
              >
                <option value="">Selecione…</option>
                {(barbers || []).filter((b) => b.role === 'Barbeiro' || !b.role).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Método">
              <select
                value={form.method || 'CAIXA'}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                {PAYOUT_METHODS.map((m) => (
                  <option key={m} value={m}>{m === 'CAIXA' ? 'Caixa' : m}</option>
                ))}
              </select>
            </Field>
            <Field label="Início do período">
              <input
                type="date"
                value={form.periodStart || startDate}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </Field>
            <Field label="Fim do período">
              <input
                type="date"
                value={form.periodEnd || endDate}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </Field>
            {['CAIXA', 'DINHEIRO', 'PIX'].includes(String(form.method || 'CAIXA').toUpperCase()) ? (
              <Field label="Caixa" full>
                <select
                  value={form.cashSessionId || ''}
                  onChange={(e) => setForm({ ...form, cashSessionId: e.target.value })}
                >
                  <option value="">{openSessions.length ? 'Selecione o caixa' : 'Nenhum caixa aberto'}</option>
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>{cashOptionLabel(s)}</option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>
          <div className="finv2-modal__actions">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                try {
                  await financeV2.createCommissionPayout({
                    barberId: Number(form.barberId),
                    amount: Number(form.amount || 0),
                    method: form.method || 'CAIXA',
                    periodStart: form.periodStart || startDate,
                    periodEnd: form.periodEnd || endDate,
                    cashSessionId: form.cashSessionId ? Number(form.cashSessionId) : undefined,
                  });
                  closeModal();
                  await refreshCommissions();
                  await refreshCash();
                } catch (err) {
                  handleError(err);
                }
              }}
            >
              Registrar
            </button>
          </div>
        </ModalShell>
      )}

      {closeReport && (
        <ModalShell
          title="Caixa fechado"
          subtitle={formatWhen(closeReport.closedAt || closeReport.snapshot?.closedAt)}
          onClose={() => setCloseReport(null)}
        >
          <CashCloseReport session={closeReport} />
          <div className="finv2-modal__actions">
            <button type="button" className="btn-primary" onClick={() => setCloseReport(null)}>
              Entendi
            </button>
          </div>
        </ModalShell>
      )}

      {sessionDetail && (
        <SessionDetailModal
          session={sessionDetail}
          canReopen={sessionDetail.status !== 'OPEN' && isGerente && !cash}
          onClose={() => setSessionDetail(null)}
          onOpenComanda={async (id) => {
            setSessionDetail(null);
            await openComandaDetail(id);
          }}
          onReopenCash={onReopenCash}
        />
      )}

      {comandaDetail && (
        <ComandaDetailModal
          comanda={comandaDetail}
          businessInfo={businessInfo}
          isGerente={isGerente}
          onClose={() => setComandaDetail(null)}
          onSettle={(c, opts) => {
            setComandaDetail(null);
            openSettleForComanda(c, opts);
          }}
          onReverse={async (c) => {
            if (!confirm('Estornar esta comanda?')) return;
            try {
              await financeV2.reverseComanda(c.id, { restoreStock: true });
              setComandaDetail(null);
              await refreshAll({ force: true });
              await refreshComandas();
            } catch (err) {
              handleError(err);
            }
          }}
          onViewSession={async (sessionId) => {
            setComandaDetail(null);
            await openSessionDetail(sessionId);
          }}
        />
      )}
    </div>
  );
}

function ReceitasTable({ financeV2, startDate, endDate, q }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    financeV2
      .listComandas({ status: 'QUITADA', startDate, endDate, q })
      .then((data) => {
        if (alive) setRows(data);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [financeV2, startDate, endDate, q]);

  if (loading) {
    return <p className="finv2-loading">Carregando receitas…</p>;
  }

  if (!rows.length) {
    return (
      <EmptyState
        title="Nenhuma receita no período"
        hint="Comandas quitadas alimentam esta lista."
      />
    );
  }

  return (
    <div className="finv2-table-wrap">
      <table className="finv2-table">
        <thead>
          <tr>
            <th>Comanda</th>
            <th>Cliente</th>
            <th>Caixa</th>
            <th>Quitação</th>
            <th className="is-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="is-strong">Nº{String(c.number).padStart(4, '0')}</td>
              <td>{c.customerName}</td>
              <td className="is-muted">
                {c.cashSession
                  ? `${c.cashSession.openedByName || 'Caixa'} · ${formatWhen(c.cashSession.openedAt)}`
                  : '—'}
              </td>
              <td className="is-muted">{formatWhen(c.closedAt)}</td>
              <td className="is-right is-strong is-in finv2-num">{money(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowBlock({ title, total, categories, expanded, setExpanded, positive }) {
  return (
    <div className="finv2-flow-block">
      <div className="finv2-flow-head">
        <strong>{title}</strong>
        <strong className={positive ? 'is-in' : 'is-out'}>{money(total)}</strong>
      </div>
      {(categories || []).map((cat) => {
        const key = `${title}-${cat.id}`;
        const open = expanded[key];
        return (
          <div key={key} className="finv2-flow-group">
            <button
              type="button"
              className="finv2-flow-row"
              onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              <span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat.name}
              </span>
              <span>{money(cat.total)}</span>
            </button>
            {open
              ? (cat.children || []).map((child) => (
                  <div key={child.id} className="finv2-flow-child">
                    <span>{child.name}</span>
                    <span>{money(child.total)}</span>
                  </div>
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
