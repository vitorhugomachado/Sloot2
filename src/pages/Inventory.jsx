import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Package, PackagePlus, X, Info, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

const ICON_BLACK = '#1f1f1f';
const ICON_STROKE = 2.25;
const MOBILE_MQ = '(max-width: 768px)';

const initialFormState = {
  name: '',
  category: 'Cabelo',
  price: '',
  cost: '',
  stock: '',
};

const formatMoney = (val) =>
  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ProductFormFields({ formData, setFormData, idPrefix = '' }) {
  const fieldClass = 'inventory-field-input';
  return (
    <div className="inventory-form-fields">
      <label className="inventory-field-label" htmlFor={`${idPrefix}inv-name`}>Nome</label>
      <input
        id={`${idPrefix}inv-name`}
        type="text"
        placeholder="Ex.: Pomada modeladora"
        className={fieldClass}
        value={formData.name}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
      />
      <label className="inventory-field-label" htmlFor={`${idPrefix}inv-cat`}>Categoria</label>
      <input
        id={`${idPrefix}inv-cat`}
        type="text"
        placeholder="Cabelo, Barba, Bebidas…"
        className={fieldClass}
        value={formData.category}
        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
      />
      <div className="inventory-form-row-2">
        <div>
          <label className="inventory-field-label" htmlFor={`${idPrefix}inv-price`}>Preço</label>
          <input
            id={`${idPrefix}inv-price`}
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            className={fieldClass}
            value={formData.price}
            onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
          />
        </div>
        <div>
          <label className="inventory-field-label" htmlFor={`${idPrefix}inv-cost`}>Custo</label>
          <input
            id={`${idPrefix}inv-cost`}
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            className={fieldClass}
            value={formData.cost}
            onChange={(e) => setFormData((prev) => ({ ...prev, cost: e.target.value }))}
          />
        </div>
      </div>
      <label className="inventory-field-label" htmlFor={`${idPrefix}inv-stock`}>Estoque inicial</label>
      <input
        id={`${idPrefix}inv-stock`}
        type="number"
        min="0"
        step="1"
        placeholder="0"
        className={fieldClass}
        value={formData.stock}
        onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
      />
    </div>
  );
}

const ProductMobileCard = ({
  product,
  isGerente,
  onInfo,
  onStockEntry,
  onEdit,
  onDelete,
}) => {
  const stock = Number(product.stock ?? 0);
  const lowStock = stock <= 5;

  return (
    <article className="inv-mobile-card glass-card">
      <button type="button" className="inv-mobile-card__main" onClick={onInfo}>
        <div className="inv-mobile-card__icon-wrap">
          <Package size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
        </div>
        <div className="inv-mobile-card__body">
          <div className="inv-mobile-card__title-row">
            <h3 className="inv-mobile-card__name">{product.name}</h3>
            <span
              className={`inv-mobile-card__stock-pill${lowStock ? ' inv-mobile-card__stock-pill--low' : ''}`}
            >
              {stock} un.
            </span>
          </div>
          <p className="inv-mobile-card__category">{product.category || '—'}</p>
          <div className="inv-mobile-card__prices">
            <span>
              <span className="inv-mobile-card__price-label">Custo</span>
              {formatMoney(product.cost)}
            </span>
            <span>
              <span className="inv-mobile-card__price-label">Preço</span>
              <strong>{formatMoney(product.price)}</strong>
            </span>
          </div>
        </div>
      </button>
      <div className="inv-mobile-card__actions">
        <button
          type="button"
          className="inventory-action-icon-btn inv-mobile-action-btn"
          title="Detalhes"
          aria-label="Detalhes do produto"
          onClick={onInfo}
        >
          <Info size={20} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        {isGerente && (
          <button
            type="button"
            className="inventory-action-icon-btn inv-mobile-action-btn"
            title="Entrada no estoque"
            aria-label="Entrada no estoque"
            onClick={onStockEntry}
          >
            <PackagePlus size={20} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className="inventory-action-icon-btn inv-mobile-action-btn"
          title="Editar"
          aria-label="Editar produto"
          onClick={onEdit}
        >
          <Pencil size={20} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <button
          type="button"
          className="inventory-action-icon-btn inventory-action-icon-btn--danger inv-mobile-action-btn"
          title="Eliminar"
          aria-label="Eliminar produto"
          onClick={onDelete}
        >
          <Trash2 size={20} stroke="#b91c1c" strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
    </article>
  );
};

const Inventory = () => {
  const { products, addProduct, updateProduct, removeProduct, adjustProductStock, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);

  const [stockEntryProduct, setStockEntryProduct] = useState(null);
  const [stockEntryQty, setStockEntryQty] = useState('1');
  const [stockEntryBusy, setStockEntryBusy] = useState(false);
  const [stockEntryErr, setStockEntryErr] = useState('');
  const [infoProduct, setInfoProduct] = useState(null);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches
  );

  const isGerente = currentUser?.role === 'Gerente';

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.name?.toLowerCase().includes(term));
  }, [products, search]);

  const stats = useMemo(() => {
    const list = filteredProducts;
    const units = list.reduce((s, p) => s + Number(p.stock || 0), 0);
    const lowStock = list.filter((p) => Number(p.stock ?? 0) <= 5).length;
    return { count: list.length, units, lowStock };
  }, [filteredProducts]);

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingProductId(null);
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    setEditingProductId(null);
    setFormData(initialFormState);
    setIsFormOpen(true);
  };

  const openStockEntry = (product) => {
    setStockEntryErr('');
    setStockEntryProduct(product);
    setStockEntryQty('1');
  };

  const closeStockEntry = () => {
    setStockEntryProduct(null);
    setStockEntryErr('');
    setStockEntryQty('1');
  };

  const handleStockEntrySubmit = async () => {
    if (!stockEntryProduct) return;
    const qty = Number.parseInt(String(stockEntryQty).trim(), 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setStockEntryErr('Informe um número inteiro maior ou igual a 1.');
      return;
    }
    setStockEntryErr('');
    setStockEntryBusy(true);
    try {
      const result = await adjustProductStock(stockEntryProduct.id, qty);
      if (!result.ok) {
        setStockEntryErr(result.message || 'Não foi possível registar a entrada.');
        return;
      }
      closeStockEntry();
    } finally {
      setStockEntryBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Informe o nome do produto.');
      return;
    }

    const parsedPrice = Number(formData.price);
    const parsedCost = Number(formData.cost || 0);
    const parsedStock = Number(formData.stock);

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Preço inválido.');
      return;
    }

    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      alert('Custo inválido.');
      return;
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      alert('Estoque deve ser um inteiro maior ou igual a zero.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'Cabelo',
      price: parsedPrice,
      cost: parsedCost,
      stock: parsedStock,
    };

    if (editingProductId) {
      await updateProduct(editingProductId, payload);
    } else {
      await addProduct(payload);
    }

    resetForm();
  };

  const handleEdit = (product) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name || '',
      category: product.category || 'Cabelo',
      price: String(product.price ?? ''),
      cost: String(product.cost ?? ''),
      stock: String(product.stock ?? 0),
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(`Deseja excluir o produto "${product.name}"?`);
    if (!confirmed) return;
    await removeProduct(product.id);
  };

  const formModal = isFormOpen && (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={resetForm}
    >
      <div
        className="modal-glass-panel fade-in inventory-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inventory-form-modal__head">
          <h2 id="inv-form-title" className="inventory-form-modal__title">
            {editingProductId ? 'Editar produto' : 'Novo produto'}
          </h2>
          <button
            type="button"
            className="inventory-form-modal__close"
            aria-label="Fechar"
            onClick={resetForm}
          >
            <X size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <ProductFormFields formData={formData} setFormData={setFormData} idPrefix="modal-" />
        <div className="inventory-form-modal__actions">
          <button type="button" className="btn-secondary inventory-form-modal__btn" onClick={resetForm}>
            Cancelar
          </button>
          <button type="button" className="btn-primary inventory-form-modal__btn" onClick={handleSubmit}>
            {editingProductId ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );

  const infoModal = infoProduct && (
    <div className="modal-backdrop" role="presentation" onClick={() => setInfoProduct(null)}>
      <div
        className="modal-glass-panel fade-in inventory-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inventory-form-modal__head">
          <h2 id="inv-info-title" className="inventory-form-modal__title inventory-form-modal__title--row">
            <Info size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
            {infoProduct.name}
          </h2>
          <button
            type="button"
            className="inventory-form-modal__close"
            aria-label="Fechar"
            onClick={() => setInfoProduct(null)}
          >
            <X size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <dl className="inventory-info-dl">
          <div className="inventory-info-dl__row">
            <dt>Categoria</dt>
            <dd>{infoProduct.category || '—'}</dd>
          </div>
          <div className="inventory-info-dl__row">
            <dt>Estoque</dt>
            <dd>{infoProduct.stock ?? 0} un.</dd>
          </div>
          <div className="inventory-info-dl__row">
            <dt>Custo</dt>
            <dd>{formatMoney(infoProduct.cost)}</dd>
          </div>
          <div className="inventory-info-dl__row">
            <dt>Preço</dt>
            <dd>{formatMoney(infoProduct.price)}</dd>
          </div>
        </dl>
        {isGerente && (
          <button
            type="button"
            className="btn-primary inventory-info-modal__entry"
            onClick={() => {
              setInfoProduct(null);
              openStockEntry(infoProduct);
            }}
          >
            <PackagePlus size={18} stroke="currentColor" strokeWidth={2} aria-hidden />
            Dar entrada no estoque
          </button>
        )}
      </div>
    </div>
  );

  const stockEntryModal = stockEntryProduct && (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => !stockEntryBusy && closeStockEntry()}
    >
      <div
        className="modal-glass-panel fade-in inventory-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-entry-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inventory-form-modal__head">
          <div>
            <h2 id="stock-entry-title" className="inventory-form-modal__title">
              Entrada no estoque
            </h2>
            <p className="inventory-stock-modal__sub">{stockEntryProduct.name}</p>
            <p className="inventory-stock-modal__stock">
              Estoque actual: <strong>{stockEntryProduct.stock ?? 0}</strong> un.
            </p>
          </div>
          <button
            type="button"
            className="inventory-form-modal__close"
            aria-label="Fechar"
            onClick={closeStockEntry}
            disabled={stockEntryBusy}
          >
            <X size={22} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <label className="inventory-field-label" htmlFor="stock-entry-qty">
          Quantidade a adicionar
        </label>
        <input
          id="stock-entry-qty"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className="inventory-field-input"
          value={stockEntryQty}
          onChange={(e) => setStockEntryQty(e.target.value)}
          disabled={stockEntryBusy}
        />
        <p className="inventory-stock-modal__hint">
          Altere o valor antes de confirmar para registar a entrada desejada.
        </p>
        {stockEntryErr && <p className="inventory-stock-modal__err">{stockEntryErr}</p>}
        <div className="inventory-form-modal__actions">
          <button
            type="button"
            className="btn-secondary inventory-form-modal__btn"
            onClick={closeStockEntry}
            disabled={stockEntryBusy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary inventory-form-modal__btn"
            onClick={handleStockEntrySubmit}
            disabled={stockEntryBusy}
          >
            {stockEntryBusy ? 'A gravar…' : 'Confirmar entrada'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="inventory-page inventory-page--mobile fade-in">
        <header className="inv-mobile-header">
          <div className="inv-mobile-header__top">
            <div>
              <h1 className="inv-mobile-title">Estoque</h1>
              <p className="inv-mobile-sub">Produtos, quantidades e entradas.</p>
            </div>
          </div>
          <button type="button" className="btn-primary inv-mobile-new-full" onClick={openCreateForm}>
            <Plus size={18} stroke="currentColor" strokeWidth={2.5} aria-hidden />
            Novo produto
          </button>
        </header>

        <div className="inv-mobile-kpi-scroll hide-scrollbar">
          <div className="inv-mobile-kpi-track">
            <div className="inv-mobile-kpi-chip glass-card">
              <div className="inv-mobile-kpi-chip__label">Produtos</div>
              <div className="inv-mobile-kpi-chip__value">{stats.count}</div>
            </div>
            <div className="inv-mobile-kpi-chip glass-card inv-mobile-kpi-chip--info">
              <div className="inv-mobile-kpi-chip__label">Unidades</div>
              <div className="inv-mobile-kpi-chip__value">{stats.units}</div>
            </div>
            {stats.lowStock > 0 && (
              <div className="inv-mobile-kpi-chip glass-card inv-mobile-kpi-chip--warn">
                <div className="inv-mobile-kpi-chip__label">Baixo estoque</div>
                <div className="inv-mobile-kpi-chip__value">{stats.lowStock}</div>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card inv-mobile-list-card">
          <div className="inv-mobile-filters">
            <div className="inv-mobile-search-wrap">
              <Search size={18} className="inv-mobile-search-icon" aria-hidden />
              <input
                type="search"
                className="inv-mobile-search-input"
                placeholder="Buscar produto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="inv-mobile-product-list">
            {filteredProducts.length === 0 ? (
              <p className="inv-mobile-empty">
                <Package size={20} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                Nenhum produto encontrado.
              </p>
            ) : (
              filteredProducts.map((product) => (
                <ProductMobileCard
                  key={product.id}
                  product={product}
                  isGerente={isGerente}
                  onInfo={() => setInfoProduct(product)}
                  onStockEntry={() => openStockEntry(product)}
                  onEdit={() => handleEdit(product)}
                  onDelete={() => handleDelete(product)}
                />
              ))
            )}
          </div>
        </div>

        {isFormOpen && formModal}
        {infoModal}
        {stockEntryModal}
      </div>
    );
  }

  return (
    <div className="inventory-page fade-in">
      <header className="inventory-desktop-header">
        <h1>Estoque</h1>
        <p>Gerencie produtos, custos e quantidades em um fluxo dedicado.</p>
      </header>

      <div className="glass-card inventory-desktop-toolbar">
        <input
          type="text"
          className="inventory-desktop-search"
          placeholder="Buscar produto por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn-primary inventory-desktop-new" onClick={openCreateForm}>
          <Plus size={16} stroke="currentColor" strokeWidth={2.5} aria-hidden />
          Novo produto
        </button>
      </div>

      {isFormOpen && !isMobile && (
        <div className="glass-card inventory-desktop-form-card">
          <h3>{editingProductId ? 'Editar produto' : 'Novo produto'}</h3>
          <div className="inventory-desktop-form-grid">
            <input
              type="text"
              placeholder="Nome"
              className="inventory-field-input"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Categoria"
              className="inventory-field-input"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Preço"
              className="inventory-field-input"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Custo"
              className="inventory-field-input"
              value={formData.cost}
              onChange={(e) => setFormData((prev) => ({ ...prev, cost: e.target.value }))}
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Estoque"
              className="inventory-field-input"
              value={formData.stock}
              onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
            />
          </div>
          <div className="inventory-desktop-form-actions">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleSubmit}>
              {editingProductId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      <div className="glass-card table-responsive inventory-desktop-table-wrap">
        <table className="inventory-desktop-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Estoque</th>
              <th>Custo</th>
              <th>Preço</th>
              <th className="inventory-desktop-table__actions-th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td className="inventory-desktop-table__name">{product.name}</td>
                <td>{product.category || '—'}</td>
                <td>{product.stock}</td>
                <td>{formatMoney(product.cost)}</td>
                <td>{formatMoney(product.price)}</td>
                <td className="inventory-desktop-table__actions-td">
                  <div className="inventory-desktop-actions">
                    <button
                      type="button"
                      className="inventory-action-icon-btn"
                      title="Resumo do produto"
                      aria-label="Resumo do produto"
                      onClick={() => setInfoProduct(product)}
                    >
                      <Info size={18} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                    </button>
                    {isGerente && (
                      <button
                        type="button"
                        className="inventory-action-icon-btn"
                        title="Entrada no estoque"
                        aria-label="Entrada no estoque"
                        onClick={() => openStockEntry(product)}
                      >
                        <PackagePlus size={18} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      className="inventory-action-icon-btn"
                      title="Editar produto"
                      aria-label="Editar produto"
                      onClick={() => handleEdit(product)}
                    >
                      <Pencil size={18} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inventory-action-icon-btn inventory-action-icon-btn--danger"
                      title="Eliminar produto"
                      aria-label="Eliminar produto"
                      onClick={() => handleDelete(product)}
                    >
                      <Trash2 size={18} stroke="#b91c1c" strokeWidth={ICON_STROKE} aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length === 0 && (
        <div className="glass-card inventory-desktop-empty">
          <Package size={18} stroke={ICON_BLACK} strokeWidth={ICON_STROKE} aria-hidden />
          Nenhum produto encontrado com os filtros atuais.
        </div>
      )}

      {infoModal}
      {stockEntryModal}
    </div>
  );
};

export default Inventory;
