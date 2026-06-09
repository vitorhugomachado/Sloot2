import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { platformTenantFetch } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';

const EMPTY_PRODUCT = { name: '', price: '', cost: '', stock: '0', category: 'Geral' };

function productToForm(p) {
  return {
    name: p.name || '',
    price: String(p.price ?? ''),
    cost: String(p.cost ?? ''),
    stock: String(p.stock ?? '0'),
    category: p.category || 'Geral',
  };
}

export default function PlatformTenantInventoryTab({ tenantId, onToast, onError }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState(EMPTY_PRODUCT);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, sls] = await Promise.all([
        platformTenantFetch(tenantId, '/products'),
        platformTenantFetch(tenantId, '/sales'),
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setSales(Array.isArray(sls) ? sls : []);
    } catch (err) {
      onError(err.message || 'Erro ao carregar estoque.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) setEditForm(productToForm(selected));
  }, [selected]);

  const addProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, '/products', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          price: parseFloat(createForm.price),
          cost: parseFloat(createForm.cost || 0),
          stock: parseInt(createForm.stock, 10) || 0,
          category: createForm.category,
        }),
      });
      setCreateForm(EMPTY_PRODUCT);
      onToast('Produto adicionado.');
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao criar produto.');
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, `/products/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          price: parseFloat(editForm.price),
          cost: parseFloat(editForm.cost || 0),
          stock: parseInt(editForm.stock, 10) || 0,
          category: editForm.category,
        }),
      });
      onToast('Produto atualizado.');
      await load();
      setSelected(null);
    } catch (err) {
      onError(err.message || 'Erro ao actualizar produto.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!selected || !window.confirm(`Excluir "${selected.name}"?`)) return;
    try {
      await platformTenantFetch(tenantId, `/products/${selected.id}`, { method: 'DELETE' });
      onToast('Produto excluído.');
      setSelected(null);
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao excluir produto.');
    }
  };

  const adjustStock = async (id, e) => {
    e?.stopPropagation?.();
    const raw = window.prompt('Quantidade a adicionar ao estoque:');
    const delta = parseInt(raw, 10);
    if (!Number.isInteger(delta) || delta <= 0) return;
    try {
      await platformTenantFetch(tenantId, `/products/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ delta }),
      });
      onToast('Estoque actualizado.');
      await load();
      if (selected?.id === id) {
        const updated = products.find((p) => p.id === id);
        if (updated) setSelected({ ...updated, stock: updated.stock + delta });
      }
    } catch (err) {
      onError(err.message || 'Erro ao actualizar estoque.');
    }
  };

  if (loading) return <p className="platform-loading">Carregando estoque…</p>;

  return (
    <>
      <PlatformPanel title="Produtos">
        {products.length === 0 ? (
          <PlatformEmptyState
            icon={Package}
            title="Nenhum produto no catálogo"
            description="Cadastre produtos para controlar stock e vendas."
          />
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={selected?.id === p.id ? 'platform-table-row--selected' : 'platform-table-row--clickable'}
                    onClick={() => { onError(''); setSelected(p); }}
                  >
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>R$ {Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td className="platform-table-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <button type="button" className="platform-table-btn dash-action-btn secondary" onClick={(e) => adjustStock(p.id, e)}>+ Stock</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="platform-form platform-form--inline" onSubmit={addProduct} style={{ marginTop: '1rem' }}>
          <label>
            Nome
            <input className="booking-reserve-form__field" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </label>
          <label>
            Preço
            <input type="number" step="0.01" className="booking-reserve-form__field" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} required />
          </label>
          <label>
            Custo
            <input type="number" step="0.01" className="booking-reserve-form__field" value={createForm.cost} onChange={(e) => setCreateForm({ ...createForm, cost: e.target.value })} />
          </label>
          <label>
            Stock inicial
            <input type="number" min="0" className="booking-reserve-form__field" value={createForm.stock} onChange={(e) => setCreateForm({ ...createForm, stock: e.target.value })} />
          </label>
          <button type="submit" className="dash-action-btn primary" disabled={saving}>
            <Plus size={16} aria-hidden />
            {saving ? 'Salvando…' : 'Adicionar produto'}
          </button>
        </form>
      </PlatformPanel>

      {selected && (
        <PlatformPanel title={`Editar produto — ${selected.name}`}>
          <form className="platform-form" onSubmit={saveProduct}>
            <label>
              Nome
              <input className="booking-reserve-form__field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </label>
            <label>
              Categoria
              <input className="booking-reserve-form__field" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            </label>
            <label>
              Preço (R$)
              <input type="number" step="0.01" min="0" className="booking-reserve-form__field" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </label>
            <label>
              Custo (R$)
              <input type="number" step="0.01" min="0" className="booking-reserve-form__field" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} />
            </label>
            <label>
              Stock
              <input type="number" min="0" className="booking-reserve-form__field" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} />
            </label>
            <div className="platform-modal-actions">
              <button type="button" className="dash-action-btn secondary platform-table-btn--danger" onClick={deleteProduct}>
                <Trash2 size={14} aria-hidden />
                Excluir
              </button>
              <button type="button" className="dash-action-btn secondary" onClick={() => setSelected(null)}>Cancelar</button>
              <button type="submit" className="dash-action-btn primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar produto'}
              </button>
            </div>
          </form>
        </PlatformPanel>
      )}

      <PlatformPanel title="Vendas recentes">
        {sales.length === 0 ? (
          <p className="platform-page-subtitle">Nenhuma venda registada.</p>
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Total</th>
                  <th>Profissional</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 20).map((s) => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{s.productName}</td>
                    <td>{s.quantity}</td>
                    <td>R$ {(Number(s.price) * Number(s.quantity)).toFixed(2)}</td>
                    <td>{s.Barber?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PlatformPanel>
    </>
  );
}
