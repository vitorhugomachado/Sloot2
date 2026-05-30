import React, { useCallback, useEffect, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { platformTenantFetch } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';

const EMPTY_PRODUCT = { name: '', price: '', cost: '', stock: '0', category: 'Geral' };

export default function PlatformTenantInventoryTab({ tenantId, onToast, onError }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_PRODUCT);
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

  const addProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await platformTenantFetch(tenantId, '/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          cost: parseFloat(form.cost || 0),
          stock: parseInt(form.stock, 10) || 0,
          category: form.category,
        }),
      });
      setForm(EMPTY_PRODUCT);
      onToast('Produto adicionado.');
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao criar produto.');
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (id) => {
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>R$ {Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td>
                      <button type="button" className="platform-table-btn" onClick={() => adjustStock(p.id)}>+ Stock</button>
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
            <input className="booking-reserve-form__field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Preço
            <input type="number" step="0.01" className="booking-reserve-form__field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </label>
          <label>
            Custo
            <input type="number" step="0.01" className="booking-reserve-form__field" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </label>
          <label>
            Stock inicial
            <input type="number" min="0" className="booking-reserve-form__field" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </label>
          <button type="submit" className="dash-action-btn primary" disabled={saving}>
            <Plus size={16} aria-hidden />
            {saving ? 'Salvando…' : 'Adicionar produto'}
          </button>
        </form>
      </PlatformPanel>

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
