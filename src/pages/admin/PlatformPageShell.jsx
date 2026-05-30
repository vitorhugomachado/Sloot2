import React from 'react';

export function PlatformKpiCard({ label, value, hint }) {
  return (
    <div className="dash-kpi-card">
      <div className="dash-kpi-top">
        <span className="dash-kpi-label">{label}</span>
      </div>
      <div className="dash-kpi-main">
        <div className="dash-kpi-data">
          <div className="dash-kpi-value">{value}</div>
          {hint ? <div className="dash-kpi-subtitle">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function PlatformPanel({ title, headerExtra, children, className = '' }) {
  return (
    <div className={`dash-panel ${className}`.trim()}>
      {title ? (
        <div className="dash-panel-header">
          <h3>{title}</h3>
          {headerExtra || null}
        </div>
      ) : null}
      <div className="dash-panel-body">{children}</div>
    </div>
  );
}

export default function PlatformPageShell({
  title,
  subtitle,
  actions,
  breadcrumb,
  tabs,
  children,
  className = '',
}) {
  return (
    <div className={`dash-page fade-in ${className}`.trim()}>
      <div className="dash-page__inner">
        {breadcrumb || null}
        {(title || actions) ? (
          <div className="dash-header">
            <div>
              {title ? <h1>{title}</h1> : null}
              {subtitle ? (
                typeof subtitle === 'string'
                  ? <p className="dash-panel-subtitle">{subtitle}</p>
                  : <div className="dash-panel-subtitle platform-page-subtitle-row">{subtitle}</div>
              ) : null}
            </div>
            {actions ? <div className="dash-header-actions">{actions}</div> : null}
          </div>
        ) : null}
        {tabs || null}
        {children}
      </div>
    </div>
  );
}
