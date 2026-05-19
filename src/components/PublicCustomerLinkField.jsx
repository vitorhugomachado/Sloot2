import React, { useMemo, useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { getPublicCustomerBookingUrl } from '../utils/publicUrls';

/**
 * Campo somente leitura com o link da página pública de clientes + copiar / abrir.
 */
export default function PublicCustomerLinkField({ className = '', compact = false }) {
  const [copied, setCopied] = useState(false);
  const bookingUrl = useMemo(() => getPublicCustomerBookingUrl(), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o link de divulgação:', bookingUrl);
    }
  };

  return (
    <div
      className={`public-customer-link-field${className ? ` ${className}` : ''}`}
      style={{
        padding: compact ? '12px' : '14px',
        borderRadius: '10px',
        border: '1px solid #0a0a0a',
        background: 'var(--panel-bg)',
      }}
    >
      <label
        style={{
          display: 'block',
          fontWeight: 600,
          marginBottom: compact ? '6px' : '8px',
          fontSize: compact ? '0.85rem' : '0.9rem',
        }}
      >
        Link de divulgação (página de clientes)
      </label>
      {!compact && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.45 }}>
          Envie este link para seus clientes agendarem online na barbearia.
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <input
          type="text"
          readOnly
          value={bookingUrl}
          aria-label="Link de divulgação da página de clientes"
          onFocus={(e) => e.target.select()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #0a0a0a',
            background: '#fff',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 14px',
            borderRadius: '9999px',
            border: '1px solid #0a0a0a',
            background: copied ? 'var(--accent-color)' : '#fff',
            color: '#0a0a0a',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir página de clientes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            flexShrink: 0,
            borderRadius: '9999px',
            border: '1px solid #0a0a0a',
            background: '#fff',
            color: '#0a0a0a',
          }}
        >
          <ExternalLink size={18} />
        </a>
      </div>
    </div>
  );
}
