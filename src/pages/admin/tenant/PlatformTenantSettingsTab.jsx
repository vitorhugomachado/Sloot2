import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Scissors, Trash2 } from 'lucide-react';
import BusinessImageUploadField from '../../../components/business/BusinessImageUploadField';
import '../../../components/business/business-hero-header.css';
import { platformTenantFetch } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';

const EMPTY_SERVICE = { name: '', price: '', duration: '30 min' };

function serviceToForm(s) {
  return {
    name: s.name || '',
    price: String(s.price ?? ''),
    duration: s.duration || '30 min',
  };
}

export default function PlatformTenantSettingsTab({ tenantId, onToast, onError }) {
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_SERVICE);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_SERVICE);
  const [savingService, setSavingService] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [biz, svc] = await Promise.all([
        platformTenantFetch(tenantId, '/business'),
        platformTenantFetch(tenantId, '/services'),
      ]);
      setBusiness(biz);
      setServices(Array.isArray(svc) ? svc : []);
    } catch (err) {
      onError(err.message || 'Erro ao carregar configuração.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) setEditForm(serviceToForm(selected));
  }, [selected]);

  const saveBusiness = async (e) => {
    e.preventDefault();
    setSavingBusiness(true);
    onError('');
    try {
      const updated = await platformTenantFetch(tenantId, '/business', {
        method: 'PATCH',
        body: JSON.stringify(business),
      });
      setBusiness(updated);
      onToast('Dados do negócio atualizados.');
    } catch (err) {
      onError(err.message || 'Erro ao salvar.');
    } finally {
      setSavingBusiness(false);
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    setSavingService(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, '/services', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          price: parseFloat(createForm.price),
          duration: createForm.duration,
        }),
      });
      setCreateForm(EMPTY_SERVICE);
      onToast('Serviço adicionado.');
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao criar serviço.');
    } finally {
      setSavingService(false);
    }
  };

  const saveService = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSavingService(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, `/services/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          price: parseFloat(editForm.price),
          duration: editForm.duration,
        }),
      });
      onToast('Serviço atualizado.');
      setSelected(null);
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao actualizar serviço.');
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (id) => {
    if (!window.confirm('Excluir este serviço?')) return;
    try {
      await platformTenantFetch(tenantId, `/services/${id}`, { method: 'DELETE' });
      if (selected?.id === id) setSelected(null);
      setServices((prev) => prev.filter((s) => s.id !== id));
      onToast('Serviço excluído.');
    } catch (err) {
      onError(err.message || 'Erro ao excluir serviço.');
    }
  };

  if (loading || !business) return <p className="platform-loading">Carregando configuração…</p>;

  const brandInitial = (business.name || 'S').trim().charAt(0).toUpperCase() || 'S';

  return (
    <>
      <PlatformPanel title="Branding e contacto">
        <form className="platform-form" onSubmit={saveBusiness}>
          <p className="platform-field-hint" style={{ marginBottom: '0.75rem' }}>
            Envie logo e banner como imagem ou remova para voltar ao padrão. Aparecem na página de agendamento.
          </p>
          <div className="biz-branding__images platform-branding-uploads">
            <BusinessImageUploadField
              label="Logo do negócio"
              hint="Quadrado, mín. 200×200 px. Aparece no círculo do header."
              value={business.logo_url || null}
              onChange={(url) => setBusiness({ ...business, logo_url: url })}
              variant="square"
              maxEdge={512}
              placeholderInitial={brandInitial}
            />
            <BusinessImageUploadField
              label="Banner"
              hint="Horizontal (ex. 1200×400 px). Fundo à direita do header."
              value={business.banner_url || null}
              onChange={(url) => setBusiness({ ...business, banner_url: url })}
              variant="banner"
              maxEdge={1600}
            />
          </div>
          <label>
            Nome público
            <input className="booking-reserve-form__field" value={business.name || ''} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
          </label>
          <label>
            Tagline
            <input className="booking-reserve-form__field" value={business.tagline || ''} onChange={(e) => setBusiness({ ...business, tagline: e.target.value })} />
          </label>
          <label>
            Slogan
            <input className="booking-reserve-form__field" value={business.slogan || ''} onChange={(e) => setBusiness({ ...business, slogan: e.target.value })} />
          </label>
          <label>
            Telefone
            <input className="booking-reserve-form__field" value={business.phone || ''} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
          </label>
          <label>
            E-mail
            <input type="email" className="booking-reserve-form__field" value={business.email || ''} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
          </label>
          <label>
            Endereço
            <input className="booking-reserve-form__field" value={business.address || ''} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
          </label>
          <label>
            Instagram
            <input className="booking-reserve-form__field" value={business.instagram_url || ''} onChange={(e) => setBusiness({ ...business, instagram_url: e.target.value })} />
          </label>
          <label className="platform-checkbox-label">
            <input type="checkbox" checked={!!business.show_instagram} onChange={(e) => setBusiness({ ...business, show_instagram: e.target.checked })} />
            Mostrar Instagram no site
          </label>
          <label>
            WhatsApp
            <input className="booking-reserve-form__field" value={business.whatsapp_url || ''} onChange={(e) => setBusiness({ ...business, whatsapp_url: e.target.value })} />
          </label>
          <label className="platform-checkbox-label">
            <input type="checkbox" checked={!!business.show_whatsapp} onChange={(e) => setBusiness({ ...business, show_whatsapp: e.target.checked })} />
            Mostrar WhatsApp no site
          </label>
          <div className="platform-modal-actions">
            <button type="submit" className="dash-action-btn primary" disabled={savingBusiness}>
              {savingBusiness ? 'Salvando…' : 'Salvar branding'}
            </button>
          </div>
        </form>
      </PlatformPanel>

      <PlatformPanel title="Catálogo de serviços">
        {services.length === 0 ? (
          <PlatformEmptyState
            icon={Scissors}
            title="Nenhum serviço cadastrado"
            description="Adicione serviços para o agendamento online e painel da equipa."
          />
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Preço</th>
                  <th>Duração</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr
                    key={s.id}
                    className={selected?.id === s.id ? 'platform-table-row--selected' : 'platform-table-row--clickable'}
                    onClick={() => { onError(''); setSelected(s); }}
                  >
                    <td>{s.name}</td>
                    <td>R$ {Number(s.price).toFixed(2)}</td>
                    <td>{s.duration}</td>
                    <td className="platform-table-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <button type="button" className="platform-table-btn platform-table-btn--danger" onClick={() => deleteService(s.id)} aria-label="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <form className="platform-form" onSubmit={saveService} style={{ marginTop: '1rem' }}>
            <p className="platform-field-hint" style={{ marginBottom: '0.75rem' }}>A editar: <strong>{selected.name}</strong></p>
            <label>
              Nome
              <input className="booking-reserve-form__field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </label>
            <label>
              Preço (R$)
              <input type="number" step="0.01" min="0" className="booking-reserve-form__field" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} required />
            </label>
            <label>
              Duração
              <input className="booking-reserve-form__field" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} />
            </label>
            <div className="platform-modal-actions">
              <button type="button" className="dash-action-btn secondary" onClick={() => setSelected(null)}>Cancelar</button>
              <button type="submit" className="dash-action-btn primary" disabled={savingService}>
                {savingService ? 'Salvando…' : 'Salvar serviço'}
              </button>
            </div>
          </form>
        )}

        <form className="platform-form platform-form--inline" onSubmit={addService} style={{ marginTop: '1rem' }}>
          <label>
            Nome
            <input className="booking-reserve-form__field" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </label>
          <label>
            Preço (R$)
            <input type="number" step="0.01" min="0" className="booking-reserve-form__field" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} required />
          </label>
          <label>
            Duração
            <input className="booking-reserve-form__field" value={createForm.duration} onChange={(e) => setCreateForm({ ...createForm, duration: e.target.value })} />
          </label>
          <button type="submit" className="dash-action-btn primary" disabled={savingService}>
            <Plus size={16} aria-hidden />
            {savingService ? 'Adicionando…' : 'Adicionar'}
          </button>
        </form>
      </PlatformPanel>
    </>
  );
}
