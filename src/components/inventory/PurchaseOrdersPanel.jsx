import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, PackageCheck, X, ShoppingCart } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ICON_BLACK = '#1f1f1f';
const ICON_STROKE = 2.25;

const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Outro'];

const formatMoney = (val) =>
  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusLabel = (status) => {
  if (status === 'RECEIVED') return 'Recebido';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Aberto';
};

const emptyLine = () => ({
  mode: 'catalog',
  productId: '',
  name: '',
  category: 'Cabelo',
  price: '',
  cost: '',
  quantity: '1',
  unitCost: '',
});

function defaultAccount(method) {
  return String(method || '').toLowerCase().includes('dinheiro') ? 'CAIXA' : 'BANCO';
}

export default function PurchaseOrdersPanel({ isGerente, createTick = 0, hideCreateButton = false }) {
  const { products, purchaseOrders, refreshProducts } = useApp();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [account, setAccount] = useState('CAIXA');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await purchaseOrders.list(statusFilter ? { status: statusFilter } : {});
      setOrders(data);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [purchaseOrders, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const catalogProducts = useMemo(
    () =>
      [...(products || [])].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }),
      ),
    [products],
  );

  const openCreate = useCallback(() => {
    setEditingId(null);
    setSupplier('');
    setNotes('');
    setLines([emptyLine()]);
    setFormOpen(true);
    refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    if (createTick > 0) openCreate();
  }, [createTick, openCreate]);

  const orderTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity) || 0;
        const unit = Number(line.unitCost) || 0;
        return sum + qty * unit;
      }, 0),
    [lines],
  );

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setSupplier('');
    setNotes('');
    setLines([emptyLine()]);
  };

  const openEdit = (order) => {
    setEditingId(order.id);
    setSupplier(order.supplier || '');
    setNotes(order.notes || '');
    setLines(
      (order.items || []).map((item) => ({
        mode: 'catalog',
        productId: String(item.productId),
        name: item.productName || '',
        category: item.product?.category || 'Cabelo',
        price: String(item.product?.price ?? ''),
        cost: String(item.unitCost ?? ''),
        quantity: String(item.quantity ?? 1),
        unitCost: String(item.unitCost ?? ''),
      })),
    );
    setFormOpen(true);
    refreshProducts();
  };

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  };

  const onSelectProduct = (idx, productId) => {
    const product = catalogProducts.find((p) => String(p.id) === String(productId));
    updateLine(idx, {
      productId: productId ? String(productId) : '',
      mode: 'catalog',
      name: product?.name || '',
      unitCost: product != null ? String(product.cost ?? '') : '',
      cost: product != null ? String(product.cost ?? '') : '',
      price: product != null ? String(product.price ?? '') : '',
      category: product?.category || 'Cabelo',
    });
  };

  const buildItemsPayload = () =>
    lines.map((line) => {
      const quantity = Number.parseInt(String(line.quantity), 10);
      const unitCost = Number(line.unitCost);
      if (line.mode === 'new') {
        return {
          name: String(line.name || '').trim(),
          category: line.category || 'Cabelo',
          price: Number(line.price || unitCost || 0),
          cost: Number(line.cost != null && line.cost !== '' ? line.cost : unitCost),
          quantity,
          unitCost,
        };
      }
      return {
        productId: Number(line.productId),
        quantity,
        unitCost,
      };
    });

  const validateLines = () => {
    if (!lines.length) {
      alert('Adicione ao menos um item.');
      return false;
    }
    for (const line of lines) {
      const qty = Number.parseInt(String(line.quantity), 10);
      const unit = Number(line.unitCost);
      if (!Number.isInteger(qty) || qty <= 0) {
        alert('Cada item precisa de quantidade inteira maior que zero.');
        return false;
      }
      if (!Number.isFinite(unit) || unit < 0) {
        alert('Cada item precisa de custo unitário válido.');
        return false;
      }
      if (line.mode === 'new') {
        if (!String(line.name || '').trim()) {
          alert('Informe o nome do produto novo.');
          return false;
        }
      } else if (!line.productId) {
        alert('Selecione um produto do catálogo ou cadastre um novo.');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateLines()) return;
    setBusy(true);
    try {
      const payload = {
        supplier: supplier.trim(),
        notes: notes.trim() || null,
        items: buildItemsPayload(),
      };
      if (editingId) {
        await purchaseOrders.update(editingId, payload);
      } else {
        await purchaseOrders.create(payload);
      }
      await refreshProducts();
      resetForm();
      await refresh();
    } catch (err) {
      alert(err.message || 'Falha ao salvar pedido');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (order) => {
    if (!window.confirm(`Cancelar o pedido #${order.id}?`)) return;
    try {
      await purchaseOrders.cancel(order.id);
      await refresh();
    } catch (err) {
      alert(err.message || 'Falha ao cancelar');
    }
  };

  const openReceive = (order) => {
    setReceiveOrder(order);
    setPaymentMethod('Dinheiro');
    setAccount('CAIXA');
  };

  const handleReceive = async () => {
    if (!receiveOrder) return;
    setBusy(true);
    try {
      await purchaseOrders.receive(receiveOrder.id, {
        paymentMethod,
        account,
      });
      await refreshProducts();
      setReceiveOrder(null);
      await refresh();
      alert('Pedido recebido: estoque atualizado e despesa lançada.');
    } catch (err) {
      if (err.code === 'CASH_CLOSED' || err.code === 'CASH_REQUIRED' || /caixa/i.test(err.message || '')) {
        alert(`${err.message || 'Abra o caixa do dia.'}\n\nVá em Financeiro → Caixa do dia.`);
      } else {
        alert(err.message || 'Falha ao receber pedido');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inv-po">
      <div className="glass-card finv2-filters inv-po__filters-bar">
        <div className="finv2-field">
          <label className="finv2-field__label" htmlFor="po-status-filter">
            Status
          </label>
          <select
            id="po-status-filter"
            className="inventory-field-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="OPEN">Abertos</option>
            <option value="RECEIVED">Recebidos</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </div>
        {!hideCreateButton && isGerente && (
          <button type="button" className="btn-primary finv2-btn-primary finv2-filters__submit" onClick={openCreate}>
            <Plus size={16} strokeWidth={2.25} aria-hidden />
            Novo pedido
          </button>
        )}
      </div>

      {loading ? (
        <p className="inv-empty">Carregando pedidos…</p>
      ) : orders.length === 0 ? (
        <div className="glass-card inv-empty">
          <ShoppingCart size={18} strokeWidth={ICON_STROKE} aria-hidden />
          Nenhum pedido de compra encontrado.
        </div>
      ) : (
        <div className="glass-card table-responsive inventory-desktop-table-wrap">
          <table className="inventory-desktop-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fornecedor</th>
                <th>Status</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Data</th>
                {isGerente && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.supplier || '—'}</td>
                  <td>
                    <span className={`inv-po__status inv-po__status--${String(order.status || '').toLowerCase()}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td>{order.items?.length || 0}</td>
                  <td>{formatMoney(order.total)}</td>
                  <td>
                    {order.orderedAt
                      ? new Date(order.orderedAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  {isGerente && (
                    <td className="inv-po__actions">
                      {order.status === 'OPEN' && (
                        <>
                          <button
                            type="button"
                            className="btn-primary finv2-btn-sm inv-po__action-btn"
                            title="Receber"
                            onClick={() => openReceive(order)}
                          >
                            <PackageCheck size={16} strokeWidth={ICON_STROKE} aria-hidden />
                            Receber
                          </button>
                          <button
                            type="button"
                            className="inventory-action-icon-btn"
                            title="Editar"
                            onClick={() => openEdit(order)}
                          >
                            <Pencil size={18} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="inventory-action-icon-btn inventory-action-icon-btn--danger"
                            title="Cancelar"
                            onClick={() => handleCancel(order)}
                          >
                            <Trash2 size={18} stroke="#b91c1c" strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onClick={resetForm}>
          <div
            className="modal-glass-panel fade-in inventory-form-modal inv-po__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="po-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory-form-modal__head">
              <h2 id="po-form-title" className="inventory-form-modal__title inventory-form-modal__title--row">
                <ShoppingCart size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                {editingId ? `Editar pedido #${editingId}` : 'Novo pedido de compra'}
              </h2>
              <button type="button" className="inventory-form-modal__close" aria-label="Fechar" onClick={resetForm}>
                <X size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} />
              </button>
            </div>

            <div className="inventory-form-fields">
              <label className="inventory-field-label" htmlFor="po-supplier">
                Fornecedor
              </label>
              <input
                id="po-supplier"
                className="inventory-field-input"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome do fornecedor"
              />
              <label className="inventory-field-label" htmlFor="po-notes">
                Observações
              </label>
              <textarea
                id="po-notes"
                className="inventory-field-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="inv-po__lines">
              <div className="inv-po__lines-head">
                <h3>Itens</h3>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                >
                  <Plus size={16} strokeWidth={ICON_STROKE} aria-hidden />
                  Linha
                </button>
              </div>

              {lines.map((line, idx) => {
                const subtotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
                return (
                  <div key={idx} className="inv-po__line glass-card">
                    <div className="inv-po__line-mode">
                      <button
                        type="button"
                        className={line.mode === 'catalog' ? 'is-active' : ''}
                        onClick={() => updateLine(idx, { mode: 'catalog', name: '', productId: line.productId || '' })}
                      >
                        Catálogo
                      </button>
                      <button
                        type="button"
                        className={line.mode === 'new' ? 'is-active' : ''}
                        onClick={() => updateLine(idx, { mode: 'new', productId: '' })}
                      >
                        Novo produto
                      </button>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className="inventory-action-icon-btn inventory-action-icon-btn--danger"
                          title="Remover linha"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={16} stroke="#b91c1c" strokeWidth={ICON_STROKE} aria-hidden />
                        </button>
                      )}
                    </div>

                    {line.mode === 'catalog' ? (
                      <label className="inventory-field-label">
                        Produto do estoque
                        <select
                          className="inventory-field-input"
                          value={line.productId}
                          onChange={(e) => onSelectProduct(idx, e.target.value)}
                        >
                          <option value="">
                            {catalogProducts.length
                              ? 'Selecione um produto…'
                              : 'Nenhum produto cadastrado'}
                          </option>
                          {catalogProducts.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}
                              {p.category ? ` · ${p.category}` : ''}
                              {` · estoque ${Number(p.stock ?? 0)}`}
                            </option>
                          ))}
                        </select>
                        {!catalogProducts.length ? (
                          <span className="inv-po__catalog-hint">
                            Cadastre produtos na aba Produtos ou use “Novo produto” nesta linha.
                          </span>
                        ) : null}
                      </label>
                    ) : (
                      <>
                        <label className="inventory-field-label">
                          Nome
                          <input
                            className="inventory-field-input"
                            value={line.name}
                            onChange={(e) => updateLine(idx, { name: e.target.value })}
                          />
                        </label>
                        <div className="inventory-form-row-2">
                          <label className="inventory-field-label">
                            Categoria
                            <input
                              className="inventory-field-input"
                              value={line.category}
                              onChange={(e) => updateLine(idx, { category: e.target.value })}
                            />
                          </label>
                          <label className="inventory-field-label">
                            Preço venda
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="inventory-field-input"
                              value={line.price}
                              onChange={(e) => updateLine(idx, { price: e.target.value })}
                            />
                          </label>
                        </div>
                      </>
                    )}

                    <div className="inventory-form-row-2">
                      <label className="inventory-field-label">
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="inventory-field-input"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        />
                      </label>
                      <label className="inventory-field-label">
                        Custo unitário
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="inventory-field-input"
                          value={line.unitCost}
                          onChange={(e) => updateLine(idx, { unitCost: e.target.value, cost: e.target.value })}
                        />
                      </label>
                    </div>
                    <p className="inv-po__line-subtotal">Subtotal: {formatMoney(subtotal)}</p>
                  </div>
                );
              })}
            </div>

            <div className="inv-po__total">
              <strong>Total do pedido:</strong> {formatMoney(orderTotal)}
            </div>

            <div className="inventory-form-modal__actions">
              <button type="button" className="btn-secondary inventory-form-modal__btn" onClick={resetForm} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn-primary inventory-form-modal__btn" onClick={handleSave} disabled={busy}>
                {busy ? 'Salvando…' : editingId ? 'Salvar' : 'Criar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiveOrder && (
        <div className="modal-backdrop" role="presentation" onClick={() => setReceiveOrder(null)}>
          <div
            className="modal-glass-panel fade-in inventory-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="po-receive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventory-form-modal__head">
              <h2 id="po-receive-title" className="inventory-form-modal__title">
                Receber pedido #{receiveOrder.id}
              </h2>
              <button
                type="button"
                className="inventory-form-modal__close"
                aria-label="Fechar"
                onClick={() => setReceiveOrder(null)}
              >
                <X size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} />
              </button>
            </div>
            <p className="inv-po__receive-summary">
              Total: <strong>{formatMoney(receiveOrder.total)}</strong>
              {receiveOrder.supplier ? ` · ${receiveOrder.supplier}` : ''}
            </p>
            <p className="inv-po__receive-hint">
              Ao confirmar, o estoque será atualizado e uma despesa paga será lançada no financeiro.
            </p>
            <div className="inventory-form-fields">
              <label className="inventory-field-label" htmlFor="po-pay-method">
                Forma de pagamento
              </label>
              <select
                id="po-pay-method"
                className="inventory-field-input"
                value={paymentMethod}
                onChange={(e) => {
                  const method = e.target.value;
                  setPaymentMethod(method);
                  setAccount(defaultAccount(method));
                }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <label className="inventory-field-label" htmlFor="po-account">
                Conta
              </label>
              <select
                id="po-account"
                className="inventory-field-input"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="CAIXA">Caixa</option>
                <option value="BANCO">Banco</option>
              </select>
            </div>
            <div className="inventory-form-modal__actions">
              <button
                type="button"
                className="btn-secondary inventory-form-modal__btn"
                onClick={() => setReceiveOrder(null)}
                disabled={busy}
              >
                Voltar
              </button>
              <button type="button" className="btn-primary inventory-form-modal__btn" onClick={handleReceive} disabled={busy}>
                {busy ? 'Recebendo…' : 'Confirmar recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
