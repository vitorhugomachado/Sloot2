import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Scissors, Trash2 } from 'lucide-react';
import { platformTenantFetch } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';

const EMPTY_SERVICE = { name: '', price: '', duration: '30 min' };

export default function PlatformTenantSettingsTab({ tenantId, onToast, onError }) {
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
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
          name: serviceForm.name,
          price: parseFloat(serviceForm.price),
          duration: serviceForm.duration,
        }),
      });
      setServiceForm(EMPTY_SERVICE);
      onToast('Serviço adicionado.');
      const svc = await platformTenantFetch(tenantId, '/services');
      setServices(Array.isArray(svc) ? svc : []);
    } catch (err) {
      onError(err.message || 'Erro ao criar serviço.');
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (id) => {
    if (!window.confirm('Excluir este serviço?')) return;
    try {
      await platformTenantFetch(tenantId, `/services/${id}`, { method: 'DELETE' });
      setServices((prev) => prev.filter((s) => s.id !== id));
      onToast('Serviço excluído.');
    } catch (err) {
      onError(err.message || 'Erro ao excluir serviço.');
    }
  };

  if (loading || !business) return <p className="platform-loading">Carregando configuração…</p>;

  return (
    <>
      <PlatformPanel title="Branding e contacto">
        <form className="platform-form" onSubmit={saveBusiness}>
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
            Logo URL
            <input className="booking-reserve-form__field" value={business.logo_url || ''} onChange={(e) => setBusiness({ ...business, logo_url: e.target.value })} />
          </label>
          <label>
            Banner URL
            <input className="booking-reserve-form__field" value={business.banner_url || ''} onChange={(e) => setBusiness({ ...business, banner_url: e.target.value })} />
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>R$ {Number(s.price).toFixed(2)}</td>
                    <td>{s.duration}</td>
                    <td>
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

        <form className="platform-form platform-form--inline" onSubmit={addService} style={{ marginTop: '1rem' }}>
          <label>
            Nome
            <input className="booking-reserve-form__field" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
          </label>
          <label>
            Preço (R$)
            <input type="number" step="0.01" min="0" className="booking-reserve-form__field" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} required />
          </label>
          <label>
            Duração
            <input className="booking-reserve-form__field" value={serviceForm.duration} onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })} />
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
