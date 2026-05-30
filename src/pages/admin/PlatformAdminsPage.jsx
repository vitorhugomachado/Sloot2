import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { platformFetch, validateStrongPassword } from './platformAuth';
import PlatformLayout from './PlatformLayout';
import PlatformPageShell, { PlatformPanel } from './PlatformPageShell';
import PlatformToast from './PlatformToast';

function AdminFormModal({ open, onClose, onSaved, admin }) {
  const isEdit = Boolean(admin);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(admin?.name || '');
      setEmail(admin?.email || '');
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [open, admin]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit || password.trim()) {
      const pwdErr = validateStrongPassword(password);
      if (pwdErr) {
        setError(pwdErr);
        return;
      }
    }
    setLoading(true);
    try {
      if (isEdit) {
        const body = { name, email };
        if (password.trim()) body.password = password;
        await platformFetch(`/admins/${admin.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await platformFetch('/admins', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-glass-panel fade-in platform-modal"
        role="dialog"
        aria-labelledby="admin-form-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="admin-form-title" className="platform-page-title">
          {isEdit ? 'Editar administrador' : 'Novo administrador'}
        </h2>
        {error && <p className="platform-form-error">{error}</p>}
        <form className="platform-form" onSubmit={handleSubmit}>
          <label>
            Nome
            <input className="booking-reserve-form__field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            E-mail
            <input type="email" className="booking-reserve-form__field" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {isEdit ? 'Nova senha (opcional)' : 'Senha *'}
            <div className="platform-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                className="booking-reserve-form__field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isEdit}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="platform-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className="platform-field-hint">Mín. 8 caracteres, maiúscula, minúscula e número.</span>
          </label>
          <div className="platform-modal-actions">
            <button type="button" className="dash-action-btn secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="dash-action-btn primary" disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlatformAdminsPage({ onLogout }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await platformFetch('/admins');
      setAdmins(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout();
        return;
      }
      setError(err.message || 'Erro ao carregar administradores');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const toggleStatus = async (admin) => {
    const deactivating = admin.status === 'active';
    if (deactivating) {
      const ok = window.confirm(`Desativar ${admin.email}? Não poderá aceder ao painel /admin.`);
      if (!ok) return;
    }
    try {
      await platformFetch(`/admins/${admin.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: deactivating ? 'inactive' : 'active' }),
      });
      await loadAdmins();
      setToast(deactivating ? 'Administrador desativado.' : 'Administrador reativado.');
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status');
    }
  };

  return (
    <PlatformLayout onLogout={onLogout}>
      <PlatformToast message={toast} onClear={() => setToast('')} />

      <PlatformPageShell
        title="Administradores"
        subtitle="Utilizadores com acesso ao painel /admin."
        actions={(
          <button
            type="button"
            className="dash-action-btn primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} aria-hidden />
            Novo admin
          </button>
        )}
      >
        {error && <p className="platform-form-error">{error}</p>}

        {loading ? (
          <p className="platform-loading">Carregando…</p>
        ) : (
          <PlatformPanel title="Contas de administrador">
            <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="platform-table-empty">
                      Nenhum administrador cadastrado.
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.email}</td>
                      <td>{a.status === 'active' ? 'Ativo' : 'Inativo'}</td>
                      <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="platform-table-actions">
                        <button
                          type="button"
                          className="dash-action-btn secondary platform-table-btn"
                          onClick={() => {
                            setEditing(a);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </button>
                        {a.status === 'active' ? (
                          <button type="button" className="dash-action-btn secondary platform-table-btn" onClick={() => toggleStatus(a)}>
                            Desativar
                          </button>
                        ) : (
                          <button type="button" className="dash-action-btn primary platform-table-btn" onClick={() => toggleStatus(a)}>
                            Reativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </PlatformPanel>
        )}
      </PlatformPageShell>

      <AdminFormModal
        open={modalOpen}
        admin={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          loadAdmins();
          setToast(editing ? 'Administrador atualizado.' : 'Administrador criado.');
        }}
      />
    </PlatformLayout>
  );
}
