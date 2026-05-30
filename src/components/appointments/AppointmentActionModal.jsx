import React from 'react';
import { X, Plus, Play, CheckCircle, XCircle, Banknote } from 'lucide-react';
import WhatsAppIcon from '../icons/WhatsAppIcon';
import { getAppointmentStatusStyle } from '../../utils/appointmentStatus';
import { formatCheckoutCurrency } from '../../hooks/useAppointmentActions';
import { normalizePhoneForWhatsApp, openWhatsAppConfirm } from '../../utils/appointmentWhatsApp';

/**
 * Modal compartilhado: iniciar, pagar (com produtos), cancelar, trocar serviço.
 */
export default function AppointmentActionModal({
  actionModal,
  setActionModal,
  paymentSplits,
  setPaymentSplits,
  checkoutProducts,
  setCheckoutProducts,
  services,
  products,
  closeActionModal,
  handleMarkInProgress,
  handleCancelAppointment,
  handleFinalizePayment,
  handleAddSplit,
  handleSplitChange,
  handleChangeService,
  handleAddCheckoutProduct,
  handleCheckoutProductChange,
  checkoutServiceTotal,
  checkoutProductsTotal,
  checkoutGrandTotal,
}) {
  if (!actionModal.open || !actionModal.app) return null;

  const app = actionModal.app;
  const statusStyle = getAppointmentStatusStyle(app.status);
  const waPhone = normalizePhoneForWhatsApp(app.phone);
  const canWhatsApp = Boolean(waPhone) && app.status !== 'Cancelado' && app.status !== 'Finalizado';

  return (
    <div className="modal-backdrop">
      <div
        className="modal-glass-panel scheduler-modal-panel fade-in"
        style={{ width: '95%', maxWidth: '480px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
      >
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
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={closeActionModal}>
            <X size={20} />
          </button>
        </div>

        <div className="action-modal-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600 }}>{app.customer}</span>
            <span
              className={`action-modal-price${actionModal.step === 'payment' ? ' action-modal-price--checkout' : ''}`}
            >
              {formatCheckoutCurrency(app.price)}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {app.service} — {app.time} — {app.date}
          </div>
          <div style={{ marginTop: '6px' }}>
            <span
              className="action-modal-status-pill"
              style={{
                background: statusStyle.bg,
                color: app.status === 'Agendado' ? 'var(--text-secondary)' : statusStyle.badge,
              }}
            >
              {app.status}
            </span>
          </div>
        </div>

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
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - R$ {s.price}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {actionModal.step === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['Agendado', 'Confirmado'].includes(app.status) && (
              <button
                type="button"
                className="action-modal-choice-btn action-modal-choice-btn--start"
                onClick={() => setActionModal({ ...actionModal, step: 'confirm-start' })}
              >
                <Play size={18} /> Iniciar Atendimento
              </button>
            )}
            {canWhatsApp ? (
              <button
                type="button"
                className="action-modal-choice-btn action-modal-choice-btn--whatsapp"
                title="Confirmar horário por WhatsApp"
                aria-label={`Enviar mensagem para ${app.customer} por WhatsApp`}
                onClick={() => openWhatsAppConfirm(app)}
              >
                <WhatsAppIcon size={18} /> Enviar mensagem no WhatsApp
              </button>
            ) : (
              <p className="action-modal-whatsapp-hint" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Cadastre um telefone válido no agendamento para enviar WhatsApp.
              </p>
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

        {actionModal.step === 'confirm-start' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Deseja realmente iniciar o atendimento de <strong>{app.customer}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActionModal({ ...actionModal, step: 'choose' })}
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={handleMarkInProgress}
                className="action-modal-cta-btn action-modal-cta-btn--confirm-blue"
                style={{ flex: 2, padding: '14px' }}
              >
                <Play size={18} /> Confirmar Início
              </button>
            </div>
          </div>
        )}

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
                    <select
                      className="action-modal-field"
                      value={split.method}
                      onChange={(e) => handleSplitChange(index, 'method', e.target.value)}
                    >
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
                        onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
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
                      {products.map((p) => (
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
                <strong>{formatCheckoutCurrency(checkoutServiceTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produtos</span>
                <strong>{formatCheckoutCurrency(checkoutProductsTotal)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '6px',
                }}
              >
                <span style={{ fontWeight: 700 }}>Total checkout</span>
                <strong className="action-modal-price action-modal-price--checkout" style={{ fontSize: '0.9rem' }}>
                  {formatCheckoutCurrency(checkoutGrandTotal)}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActionModal({ ...actionModal, step: 'choose' })}
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
              >
                ← Voltar
              </button>
              <button
                type="button"
                className="action-modal-cta-btn action-modal-cta-btn--confirm-green"
                style={{
                  flex: 2,
                  padding: '14px',
                }}
                onClick={handleFinalizePayment}
              >
                <Banknote size={18} /> Finalizar Recebimento
              </button>
            </div>
          </div>
        )}

        {actionModal.step === 'confirm-cancel' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tem certeza que deseja cancelar o agendamento de <strong>{app.customer}</strong>? Esta ação não pode ser
              desfeita.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActionModal({ ...actionModal, step: 'choose' })}
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelAppointment}
                className="action-modal-cta-btn action-modal-cta-btn--danger"
                style={{ flex: 2, padding: '14px' }}
              >
                <XCircle size={18} /> Confirmar Cancelamento
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
