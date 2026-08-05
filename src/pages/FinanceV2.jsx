import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { todayIsoLocal } from '../utils/dateLocal';

const TABS = [
  { id: 'Extrato', label: 'Extrato' },
  { id: 'Despesas', label: 'Despesas' },
  { id: 'Receitas', label: 'Receitas' },
  { id: 'Caixas', label: 'Caixas' },
  { id: 'Comandas', label: 'Comandas' },
  { id: 'Comissões', label: 'Comissões' },
  { id: 'Fluxo', label: 'Fluxo' },
];

const PAY_METHODS = ['Pix', 'Dinheiro', 'Cartão', 'Outro'];

function money(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function ModalShell({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal-glass-panel finv2-modal ${wide ? 'finv2-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="finv2-modal__head">
          <div>
            <h3 className="finv2-modal__title">{title}</h3>
            {subtitle ? <p className="finv2-modal__sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="finv2-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="finv2-modal__body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`finv2-field ${full ? 'finv2-field--full' : ''}`}>
      <span className="finv2-field__label">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ icon: Icon = Receipt, title, hint }) {
  return (
    <div className="finv2-empty">
      <div className="finv2-empty__icon">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <p className="finv2-empty__title">{title}</p>
      {hint ? <p className="finv2-empty__hint">{hint}</p> : null}
    </div>
  );
}

function StatusPill({ tone, children }) {
  return <span className={`finv2-pill finv2-pill--${tone}`}>{children}</span>;
}

export default function FinanceV2({ isActive = true }) {
  const { financeV2, currentUser } = useApp();
  const isGerente = currentUser?.role === 'Gerente';

  const initialRange = monthStartEnd();
  const [tab, setTab] = useState('Extrato');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const [cash, setCash] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [ledger, setLedger] = useState({ summary: {}, entries: [] });
  const [expenses, setExpenses] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [comandaFilter, setComandaFilter] = useState('OPEN');
  const [categories, setCategories] = useState([]);
  const [flow, setFlow] = useState(null);
  const [flowMonth, setFlowMonth] = useState(monthNow());
  const [expandedCats, setExpandedCats] = useState({});
  const [commissions, setCommissions] = useState({ rows: [], byBarber: [], totals: {} });

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [closeReport, setCloseReport] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [comandaDetail, setComandaDetail] = useState(null);

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
    const data = await financeV2.getCommissions({ startDate, endDate });
    setCommissions(data);
  }, [financeV2, startDate, endDate]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshCash(),
        refreshLedger(),
        financeV2.listCategories().then(setCategories),
        financeV2.listCashSessions().then(setSessions),
      ]);
      if (tab === 'Despesas') await refreshExpenses();
      if (tab === 'Comandas') await refreshComandas();
      if (tab === 'Comissões') await refreshCommissions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [refreshCash, refreshLedger, refreshExpenses, refreshComandas, refreshCommissions, financeV2, tab]);

  useEffect(() => {
    if (!isActive) return;
    refreshAll();
  }, [isActive, tab, startDate, endDate, comandaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (type, seed = {}) => {
    setForm(seed);
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setForm({});
  };

  const handleError = (err) => {
    if (err?.code === 'CASH_CLOSED' || err?.code === 'CASH_REQUIRED' || /caixa/i.test(err?.message || '')) {
      alert(err.message || 'Selecione ou abra o caixa do dia antes de continuar.');
      setTab('Caixas');
      return;
    }
    alert(err?.message || 'Operação falhou');
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
    if (!confirm('Reabrir este caixa? Ele volta a receber movimentos e pagamentos.')) return;
    try {
      await financeV2.reopenCash(sessionId);
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
      closeModal();
      setCloseReport(closed);
      await refreshCash();
      await financeV2.listCashSessions().then(setSessions);
    } catch (err) {
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
      await refreshAll();
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
      await refreshAll();
      await refreshExpenses();
    } catch (err) {
      handleError(err);
    }
  };

  const onCreateEntrada = async () => {
    try {
      const total = Number(form.total || 0);
      if (!form.customerName || !(total > 0)) {
        alert('Informe cliente e valor');
        return;
      }
      if (form.payNow && !form.cashSessionId) {
        alert('Selecione o caixa do dia para confirmar o recebimento.');
        return;
      }
      const comanda = await financeV2.createComanda({
        customerName: form.customerName,
        origin: 'MANUAL',
        total,
        items: [
          {
            itemType: 'SERVICE',
            name: form.itemName || 'Receita manual',
            quantity: 1,
            unitPrice: total,
          },
        ],
      });
      if (form.payNow) {
        await financeV2.settleComanda(comanda.id, {
          cashSessionId: Number(form.cashSessionId),
          splits: [{ method: form.method || 'Pix', amount: total }],
        });
      }
      closeModal();
      await refreshAll();
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
      const splits = (form.splits || []).map((s) => ({
        method: s.method || 'Pix',
        amount: Number(s.amount || 0),
      }));
      await financeV2.settleComanda(form.comandaId, {
        cashSessionId: Number(form.cashSessionId),
        splits,
      });
      closeModal();
      await refreshAll();
      await refreshComandas();
    } catch (err) {
      handleError(err);
    }
  };

  const onEditComandaItems = async () => {
    try {
      const items = (form.items || [])
        .filter((i) => i.name && Number(i.unitPrice) >= 0)
        .map((i) => ({
          itemType: i.itemType || 'SERVICE',
          name: i.name,
          quantity: Math.max(1, Number(i.quantity || 1)),
          unitPrice: Number(i.unitPrice || 0),
          productId: i.productId || null,
          serviceId: i.serviceId || null,
          barberId: i.barberId || null,
        }));
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

  const cashOptionLabel = (session) => {
    if (!session) return 'Caixa';
    return `${session.openedByName || 'Caixa'} · ${formatWhen(session.openedAt)}`;
  };

  const defaultCashSessionId = () => {
    if (cash?.id) return String(cash.id);
    if (openSessions.length === 1) return String(openSessions[0].id);
    return '';
  };

  const showFilters = ['Extrato', 'Despesas', 'Receitas', 'Comandas', 'Comissões'].includes(tab);
  const showKpis = ['Extrato', 'Despesas', 'Receitas'].includes(tab);

  const exportLedgerCsv = () => {
    const rows = filteredEntries;
    const header = ['Data', 'Tipo', 'Título', 'Forma', 'Categoria', 'Valor', 'Status'];
    const lines = [
      header.join(';'),
      ...rows.map((e) =>
        [
          e.date,
          e.kind === 'IN' ? 'Receita' : 'Despesa',
          `"${String(e.title || '').replace(/"/g, '""')}"`,
          e.paymentMethod || '',
          e.category || '',
          String(e.amount).replace('.', ','),
          e.status || '',
        ].join(';'),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="finance-page finv2-page">
      <header className="finv2-hero">
        <div className="finv2-hero__copy">
          <p className="finv2-eyebrow">Gestão</p>
          <h1>Financeiro</h1>
          <p className="finv2-hero__lead">
            Caixa do dia, comandas e lançamentos — no mesmo visual do painel Sloot.
          </p>
        </div>
        <div className="finv2-hero__actions">
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
              })
            }
          >
            <ArrowUpRight size={16} strokeWidth={2.25} />
            Nova entrada
          </button>
        </div>
      </header>

      <section className={`glass-card finv2-cash-card ${cash ? 'is-open' : 'is-closed'}`}>
        <div className="finv2-cash-card__left">
          <div className="finv2-cash-card__icon">
            <Wallet size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="finv2-cash-card__row">
              <h2>Caixa do dia</h2>
              <StatusPill tone={cash ? 'ok' : 'muted'}>{cash ? 'Aberto' : 'Fechado'}</StatusPill>
            </div>
            {cash ? (
              <p>
                Aberto por <strong>{cash.openedByName || 'equipe'}</strong>
                {' · '}
                {formatWhen(cash.openedAt)}
              </p>
            ) : (
              <p>Abra o caixa para confirmar recebimentos e pagar saídas na conta Caixa.</p>
            )}
          </div>
        </div>
        {cash ? (
          <div className="finv2-cash-metrics">
            <div>
              <span>Entradas</span>
              <strong className="is-in">{money(cash.totals?.totalIn)}</strong>
            </div>
            <div>
              <span>Saídas</span>
              <strong className="is-out">{money(cash.totals?.totalOut)}</strong>
            </div>
            <div>
              <span>Dinheiro esperado</span>
              <strong>{money(cash.totals?.expectedCash)}</strong>
            </div>
          </div>
        ) : isGerente ? (
          <button
            type="button"
            className="btn-primary finv2-btn-primary"
            onClick={() => {
              setTab('Caixas');
              openModal('openCash', { openingFloat: 0, date: todayIsoLocal() });
            }}
          >
            Abrir caixa
          </button>
        ) : null}
      </section>

      <nav className="finance-tab-nav finv2-tabs" aria-label="Seções do financeiro">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {tab === t.id ? <span className="finv2-tab-underline" /> : null}
          </button>
        ))}
      </nav>

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
            onClick={refreshAll}
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
              <table className="finv2-table">
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
                      <td className="is-muted">{e.date}</td>
                      <td className="is-strong">{e.title}</td>
                      <td>{e.paymentMethod || '—'}</td>
                      <td>{e.category}</td>
                      <td className={`is-right is-strong ${e.amount < 0 ? 'is-out' : 'is-in'}`}>
                        {money(e.amount)}
                      </td>
                      <td>
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
                        <td className="is-muted">{e.dueDate || e.date}</td>
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
                        onClick={() =>
                          openModal('closeCash', {
                            countedCash: cash.totals?.expectedCash ?? 0,
                          })
                        }
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
                        <td className={`is-right is-strong ${m.type === 'IN' ? 'is-in' : 'is-out'}`}>
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
                { id: 'QUITADA', label: 'Finalizadas' },
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
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Comanda</th>
                    <th>Cliente</th>
                    <th>Caixa</th>
                    <th>Abertura</th>
                    <th className="is-right">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {comandas.map((c) => (
                    <tr key={c.id}>
                      <td className="is-strong">Nº{String(c.number).padStart(4, '0')}</td>
                      <td>{c.customerName}</td>
                      <td className="is-muted">
                        {c.cashSession
                          ? `${c.cashSession.openedByName || 'Caixa'} · ${formatWhen(c.cashSession.openedAt)}`
                          : cash
                            ? cash.openedByName || 'Caixa atual'
                            : 'Sem caixa'}
                      </td>
                      <td className="is-muted">{formatWhen(c.openedAt)}</td>
                      <td className="is-right is-strong">{money(c.total)}</td>
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
                          {c.status === 'OPEN' ? (
                            <>
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
                              <button
                                type="button"
                                className="btn-primary finv2-btn-primary finv2-btn-sm"
                                onClick={() =>
                                  openModal('settle', {
                                    comandaId: c.id,
                                    total: c.total,
                                    customerName: c.customerName,
                                    cashSessionId: defaultCashSessionId(),
                                    splits: [{ method: 'Pix', amount: Number(c.total || 0) }],
                                  })
                                }
                              >
                                Confirmar
                              </button>
                              {isGerente ? (
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
                                  await refreshAll();
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={comandaFilter === 'OPEN' ? 'Nenhuma comanda aberta' : 'Nenhuma comanda finalizada'}
              hint="Ao finalizar um atendimento com pagamento, a comanda entra aqui."
            />
          )}
        </div>
      )}

      )}

      {tab === 'Comissões' && (
        <div className="finv2-stack">
          <div className="dash-kpi-row finv2-kpi-row">
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Bruto serviços</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalGross)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">A repassar</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalBarber)}</div>
            </div>
            <div className="dash-kpi-card">
              <div className="dash-kpi-top"><span className="dash-kpi-label">Retenção casa</span></div>
              <div className="dash-kpi-value">{money(commissions.totals?.totalHouse)}</div>
            </div>
          </div>
          <div className="glass-card finv2-panel">
            <div className="finv2-panel__head">
              <h3>Por profissional</h3>
              <span>{(commissions.byBarber || []).length} profissionais</span>
            </div>
            {(commissions.byBarber || []).length ? (
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th className="is-right">Serviços</th>
                      <th className="is-right">Bruto</th>
                      <th className="is-right">Repasse</th>
                      <th className="is-right">Casa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(commissions.byBarber || []).map((b) => (
                      <tr key={b.barberId || 'none'}>
                        <td className="is-strong">{b.barberName}</td>
                        <td className="is-right">{b.count}</td>
                        <td className="is-right">{money(b.totalGross)}</td>
                        <td className="is-right is-in is-strong">{money(b.totalBarber)}</td>
                        <td className="is-right">{money(b.totalHouse)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem comissões no período" hint="Quitações de serviços alimentam este relatório. Configure % por serviço em Configurações." />
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
                      <th className="is-right">Repasse</th>
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

      {tab === 'Fluxo' && (
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <div>
              <h3>Fluxo de caixa</h3>
              <p className="finv2-panel__hint">Árvore por categoria no mês selecionado</p>
            </div>
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

      {modal === 'openCash' && (
        <ModalShell
          title="Abrir caixa"
          subtitle="Escolha a data do caixa (hoje ou outro dia) e o troco inicial"
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
            <Field label="Troco inicial (R$)" full>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.openingFloat ?? 0}
                onChange={(e) => setForm({ ...form, openingFloat: e.target.value })}
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
            <button type="button" className="btn-primary" onClick={onOpenCash}>
              Abrir caixa
            </button>
          </div>
        </ModalShell>
      )}

      {modal === 'closeCash' && (
        <ModalShell title="Fechar caixa" subtitle={`Esperado em dinheiro: ${money(cash?.totals?.expectedCash)}`} onClose={closeModal}>
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
            <button type="button" className="btn-primary" onClick={onCloseCash}>
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
        <ModalShell title="Nova entrada" subtitle="Cria uma comanda manual" onClose={closeModal}>
          <div className="finv2-form">
            <Field label="Cliente" full>
              <input
                value={form.customerName || ''}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </Field>
            <Field label="Descrição" full>
              <input
                value={form.itemName || ''}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                placeholder="Serviço / produto"
              />
            </Field>
            <Field label="Valor (R$)" full>
              <input
                type="number"
                step="0.01"
                value={form.total || ''}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            </Field>
          </div>
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
          subtitle={`${form.customerName || 'Cliente'} · total ${money(form.total)}`}
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
          <div className="finv2-settle-list">
            {(form.splits || []).map((split, idx) => (
              <div key={idx} className="finv2-form finv2-form--2">
                <Field label="Forma">
                  <select
                    value={split.method}
                    onChange={(e) => {
                      const splits = [...form.splits];
                      splits[idx] = { ...splits[idx], method: e.target.value };
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
              Finalizar e salvar
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
            {(form.items || []).map((item, idx) => (
              <div key={idx} className="finv2-form finv2-form--2">
                <Field label="Tipo">
                  <select
                    value={item.itemType || 'SERVICE'}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx], itemType: e.target.value };
                      setForm({ ...form, items });
                    }}
                  >
                    <option value="SERVICE">Serviço</option>
                    <option value="PRODUCT">Produto</option>
                  </select>
                </Field>
                <Field label="Nome">
                  <input
                    value={item.name || ''}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx], name: e.target.value };
                      setForm({ ...form, items });
                    }}
                  />
                </Field>
                <Field label="Qtd">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity || 1}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx], quantity: e.target.value };
                      setForm({ ...form, items });
                    }}
                  />
                </Field>
                <Field label="Unitário">
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPrice || 0}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx], unitPrice: e.target.value };
                      setForm({ ...form, items });
                    }}
                  />
                </Field>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="finv2-btn finv2-btn--block"
            onClick={() =>
              setForm({
                ...form,
                items: [
                  ...(form.items || []),
                  { itemType: 'SERVICE', name: '', quantity: 1, unitPrice: 0 },
                ],
              })
            }
          >
            <Plus size={15} /> Item
          </button>
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
        <ModalShell
          title={`Caixa #${sessionDetail.id}`}
          subtitle={`${sessionDetail.status === 'OPEN' ? 'Aberto' : 'Fechado'} · ${formatWhen(sessionDetail.openedAt)}`}
          onClose={() => setSessionDetail(null)}
          wide
        >
          <CashCloseReport session={sessionDetail} />
          {sessionDetail.movements?.length ? (
            <div className="finv2-table-wrap" style={{ marginTop: 16 }}>
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
                  {sessionDetail.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="is-muted">{formatWhen(m.createdAt)}</td>
                      <td>{m.type === 'IN' ? 'Entrada' : 'Saída'}</td>
                      <td>{m.method}</td>
                      <td>{m.description}</td>
                      <td className={`is-right is-strong ${m.type === 'IN' ? 'is-in' : 'is-out'}`}>
                        {money(m.type === 'IN' ? m.amount : -m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="finv2-modal__actions">
            {sessionDetail.status !== 'OPEN' && isGerente && !cash ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onReopenCash(sessionDetail.id)}
              >
                Reabrir caixa
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => setSessionDetail(null)}>
              Fechar
            </button>
          </div>
        </ModalShell>
      )}

      {comandaDetail && (
        <ModalShell
          title={`Comanda Nº${String(comandaDetail.number).padStart(4, '0')}`}
          subtitle={`${comandaDetail.customerName} · ${comandaDetail.status === 'QUITADA' ? 'Quitada' : comandaDetail.status === 'CANCELLED' ? 'Cancelada' : 'Aberta'}`}
          onClose={() => setComandaDetail(null)}
          wide
        >
          <div className="finv2-cash-metrics" style={{ marginBottom: 16 }}>
            <div>
              <span>Total</span>
              <strong>{money(comandaDetail.total)}</strong>
            </div>
            <div>
              <span>Abertura</span>
              <strong style={{ fontSize: '0.9rem' }}>{formatWhen(comandaDetail.openedAt)}</strong>
            </div>
            <div>
              <span>Quitação</span>
              <strong style={{ fontSize: '0.9rem' }}>{formatWhen(comandaDetail.closedAt)}</strong>
            </div>
          </div>
          {(comandaDetail.items || []).length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Tipo</th>
                    <th className="is-right">Qtd</th>
                    <th className="is-right">Unit.</th>
                    <th className="is-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comandaDetail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="is-strong">{item.name}</td>
                      <td>{item.itemType === 'PRODUCT' ? 'Produto' : 'Serviço'}</td>
                      <td className="is-right">{item.quantity}</td>
                      <td className="is-right">{money(item.unitPrice)}</td>
                      <td className="is-right is-strong">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem itens" hint="Comanda sem itens detalhados." />
          )}
          {Array.isArray(comandaDetail.payments?.splits) && comandaDetail.payments.splits.length ? (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Pagamentos</h4>
              <div className="finv2-table-wrap">
                <table className="finv2-table">
                  <thead>
                    <tr>
                      <th>Forma</th>
                      <th className="is-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comandaDetail.payments.splits.map((s, i) => (
                      <tr key={i}>
                        <td>{s.method}</td>
                        <td className="is-right is-in is-strong">{money(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="finv2-modal__actions">
            {comandaDetail.status === 'OPEN' ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setComandaDetail(null);
                  openModal('settle', {
                    comandaId: comandaDetail.id,
                    total: comandaDetail.total,
                    customerName: comandaDetail.customerName,
                    cashSessionId: defaultCashSessionId(),
                    splits: [{ method: 'Pix', amount: Number(comandaDetail.total || 0) }],
                  });
                }}
              >
                Confirmar recebimento
              </button>
            ) : null}
            {comandaDetail.status === 'QUITADA' && isGerente ? (
              <button
                type="button"
                className="finv2-btn"
                onClick={async () => {
                  if (!confirm('Estornar esta comanda?')) return;
                  try {
                    await financeV2.reverseComanda(comandaDetail.id, { restoreStock: true });
                    setComandaDetail(null);
                    await refreshAll();
                    await refreshComandas();
                  } catch (err) {
                    handleError(err);
                  }
                }}
              >
                Estornar
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => setComandaDetail(null)}>
              Fechar
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function CashCloseReport({ session }) {
  const totals = session?.totals || session?.snapshot || {};
  const byMethod = totals.byMethod || {};
  const counted = session?.countedCash ?? totals.countedCash;
  const expected = totals.expectedCash;
  const difference =
    totals.difference != null
      ? totals.difference
      : counted != null && expected != null
        ? Number(counted) - Number(expected)
        : null;

  return (
    <div className="finv2-close-report">
      <div className="finv2-cash-metrics">
        <div>
          <span>Entradas</span>
          <strong className="is-in">{money(totals.totalIn)}</strong>
        </div>
        <div>
          <span>Saídas</span>
          <strong className="is-out">{money(totals.totalOut)}</strong>
        </div>
        <div>
          <span>Saldo movimentos</span>
          <strong>{money(totals.balance)}</strong>
        </div>
      </div>
      <div className="finv2-cash-metrics" style={{ marginTop: 12 }}>
        <div>
          <span>Dinheiro esperado</span>
          <strong>{money(expected)}</strong>
        </div>
        <div>
          <span>Dinheiro contado</span>
          <strong>{counted != null ? money(counted) : '—'}</strong>
        </div>
        <div>
          <span>Diferença</span>
          <strong className={difference > 0 ? 'is-in' : difference < 0 ? 'is-out' : ''}>
            {difference != null ? money(difference) : '—'}
          </strong>
        </div>
      </div>
      {Object.keys(byMethod).length ? (
        <div className="finv2-table-wrap" style={{ marginTop: 16 }}>
          <table className="finv2-table">
            <thead>
              <tr>
                <th>Forma</th>
                <th className="is-right">Entradas</th>
                <th className="is-right">Saídas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byMethod).map(([method, vals]) => (
                <tr key={method}>
                  <td className="is-strong">{method}</td>
                  <td className="is-right is-in">{money(vals.in)}</td>
                  <td className="is-right is-out">{money(vals.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
              <td className="is-right is-strong is-in">{money(c.total)}</td>
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
