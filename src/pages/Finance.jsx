import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, DollarSign, PieChart, Sparkles, User, Filter,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Scissors, Trophy, Store, LayoutList, CreditCard, Plus, Edit2, Trash2, X, Wallet,
  Calendar, Landmark, Percent, Receipt, Target, Search, ChevronRight, Download, Users, QrCode, Lock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { buildCommissionReport, indexBarbersById, splitAppointmentCommission, getShopPercent } from '../utils/commission';

// --- SHARED COMPONENTS ---

const KPICard = ({ title, value, icon, color, subtext }) => (
  <div className="glass-card" style={{ padding: '1.5rem', borderLeft: `6px solid ${color}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{title}</span>
      <div style={{ background: `${color}15`, color: color, padding: '8px', borderRadius: '10px' }}>{React.createElement(icon, { size: 18 })}</div>
    </div>
    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
    {subtext && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{subtext}</div>}
  </div>
);

const SectionHeader = ({ title, subTitle, badge, className = '' }) => (
  <div className={`finance-section-header ${className}`.trim()}>
     <div>
       <h2>{title}</h2>
       <p>{subTitle}</p>
     </div>
     {badge && <div className="finance-section-header__badge">{badge}</div>}
  </div>
);

const getLocalDateStr = (d) => {
  let dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().split('T')[0];
};

const formatCurrency = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Ícone de informação (SVG Material) — detalhes do fechamento por período */
const PeriodClosingInfoSvg = ({ size = 24, style, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'block', flexShrink: 0, ...style }}
    {...rest}
  >
    <path d="M480-680q17 0 28.5-11.5T520-720q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720q0 17 11.5 28.5T480-680Zm-40 320h80v-240h-80v240ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z" />
  </svg>
);

function getMonthFinancialSnapshot(monthStr, getFinancialStats, barbersById) {
  const parts = monthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const start = getLocalDateStr(new Date(year, month - 1, 1));
  const end = getLocalDateStr(new Date(year, month, 0));
  const s = getFinancialStats(start, end);
  const repasse = buildCommissionReport(s.appointments, barbersById, { aggregateByBarber: false }).totals.totalBarber;
  return { ...s, commissionValue: repasse, netProfit: s.revenue - repasse - s.expenses - s.productCost };
}

// --- TAB COMPONENTS ---

const VisaoGeralTab = ({ stats, startDate, endDate, netProfit, repasseServicos, retencaoCasaServicos, netMargin }) => {
  const chartData = useMemo(() => {
    const dataMap = {};
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      const s = getLocalDateStr(curr);
      dataMap[s] = { date: s.split('-').reverse().slice(0, 2).join('/'), total: 0 };
      curr.setDate(curr.getDate() + 1);
    }
    stats.appointments.forEach(app => { if (dataMap[app.date]) dataMap[app.date].total += app.price; });
    stats.sales.forEach(sale => { if (dataMap[sale.date]) dataMap[sale.date].total += (sale.price * sale.quantity); });
    return Object.values(dataMap);
  }, [stats, startDate, endDate]);

  return (
    <div className="fade-in">
      <div className="finance-kpi-grid">
        <KPICard title="Receita Bruta" value={formatCurrency(stats.revenue)} icon={DollarSign} color="var(--kpi-revenue)" subtext="vs faturamento anterior" />
        <KPICard title="Lucro Líquido" value={formatCurrency(netProfit)} icon={TrendingUp} color="var(--kpi-profit)" />
        <KPICard title="Repasse profissionais (serviços)" value={formatCurrency(repasseServicos)} icon={Receipt} color="var(--kpi-commission)" subtext="valor a repassar aos profissionais" />
        <KPICard title="Retenção casa (serviços)" value={formatCurrency(retencaoCasaServicos)} icon={Landmark} color="#6366f1" subtext="% conforme cadastro do barbeiro" />
        <KPICard title="Ticket Médio" value={formatCurrency(stats.averageTicket)} icon={Target} color="var(--kpi-ticket)" />
        <KPICard title="Venda Produtos" value={formatCurrency(stats.productRevenue)} icon={ShoppingBag} color="var(--kpi-sales)" />
        <KPICard title="Margem Líquida" value={`${netMargin.toFixed(1)}%`} icon={Percent} color="var(--kpi-margin)" />
      </div>

      <div className="glass-card finance-chart-card">
        <SectionHeader title="Evolução da Receita" subTitle="Performance diária da barbearia" />
        <ResponsiveContainer width="100%" height="80%">
          <AreaChart data={chartData}>
            <defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.1}/><stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis axisLine={false} tickLine={false} hide />
            <Tooltip
              contentStyle={{ background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}
              formatter={(value) => [formatCurrency(Number(value)), 'Faturamento do dia']}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="total" name="Faturamento" stroke="var(--accent-color)" strokeWidth={3} fill="url(#colorTotal)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="finance-summary-grid">
        <div className="glass-card" style={{ padding: '2rem' }}>
          <SectionHeader title="Mix de Receita" subTitle="Detalhamento por categorias" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {[
               { label: 'Serviços', val: stats.serviceRevenue },
               { label: 'Produtos', val: stats.productRevenue },
               { label: 'Lucro da Casa (Livre)', val: netProfit, isBold: true },
               { label: 'Repasse a profissionais (serviços)', val: repasseServicos },
               { label: 'Retenção da casa (serviços)', val: retencaoCasaServicos }
             ].map(item => (
               <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                 <span style={{ fontSize: '0.9rem', color: item.isBold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: item.isBold ? 700 : 500 }}>{item.label}</span>
                 <span style={{ fontWeight: 700 }}>{formatCurrency(item.val)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>({(stats.revenue > 0 ? (item.val/stats.revenue)*100 : 0).toFixed(0)}%)</span></span>
               </div>
             ))}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <SectionHeader title="Resumo Financeiro" subTitle="Indicadores chave de desempenho" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {[
               { label: 'Receita Bruta Total', val: formatCurrency(stats.revenue) },
               { label: '↳ Serviços', val: formatCurrency(stats.serviceRevenue), isSub: true },
               { label: '↳ Produtos', val: formatCurrency(stats.productRevenue), isSub: true },
               { label: '(-) Repasse profissionais (serviços)', val: formatCurrency(repasseServicos), color: '#ef4444' },
               { label: '(=) Lucro Líquido da Casa', val: formatCurrency(netProfit), isHighlight: true },
               { label: 'Clientes Atendidos', val: stats.appointments.length },
               { label: 'Total de Transações', val: stats.appointments.length + stats.sales.length }
             ].map(row => (
               <div key={row.label} style={{ 
                 display: 'flex', justifyContent: 'space-between', padding: row.isHighlight ? '10px 15px' : '4px 0', 
                 background: row.isHighlight ? '#000' : 'transparent', color: row.isHighlight ? '#FFF' : 'inherit',
                 borderRadius: '8px', marginLeft: row.isSub ? '1.5rem' : '0'
               }}>
                 <span style={{ fontSize: '0.85rem' }}>{row.label}</span>
                 <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DRETab = ({ stats, startDate, endDate, netProfit, repasseServicos, retencaoCasaServicos, netMargin }) => {
  const lines = [
    { label: '(+) RECEITA BRUTA', val: stats.revenue, isGroup: true },
    { label: '↳ Serviços prestados (valor cheio)', val: stats.serviceRevenue, isSub: true },
    { label: '↳ Venda de produtos', val: stats.productRevenue, isSub: true },
    { label: '(-) DEDUÇÕES', val: repasseServicos + stats.productCost, isGroup: true, color: '#ef4444' },
    { label: '↳ Repasse a profissionais (serviços)', val: repasseServicos, isSub: true },
    { label: '↳ Custo dos produtos (CPV)', val: stats.productCost, isSub: true },
    { label: '(=) LUCRO BRUTO', val: stats.revenue - (repasseServicos + stats.productCost) },
    { label: '(-) DESPESAS OPERACIONAIS', val: stats.expenses, isGroup: true, color: '#ef4444' },
    { label: '↳ Despesas fixas / Marketing', val: stats.expenses, isSub: true },
    { label: '(=) EBITDA / RESULTADO LÍQUIDO', val: netProfit, isHighlight: true, color: 'var(--kpi-revenue)' }
  ];

  return (
    <div className="fade-in glass-card" style={{ padding: '2rem' }}>
      <SectionHeader title="DRE — Demonstração do Resultado" subTitle={`Período: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} · Retenção casa (serviços): ${formatCurrency(retencaoCasaServicos)}`} badge={`Margem: ${netMargin.toFixed(1)}%`} />
      <div className="finance-dre">
        <div className="finance-dre-head">
          <span>DESCRIÇÃO</span>
          <span>VALOR (R$)</span>
          <span>% RECEITA</span>
        </div>
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`finance-dre-row${line.isGroup ? ' finance-dre-row--group' : ''}${line.isHighlight ? ' finance-dre-row--highlight' : ''}${line.isSub ? ' finance-dre-row--sub' : ''}`}
          >
            <span style={{ color: line.color }}>{line.label}</span>
            <span style={{ color: line.color }}>{formatCurrency(line.val)}</span>
            <span>{stats.revenue > 0 ? ((line.val / stats.revenue) * 100).toFixed(1) : '0'}%</span>
          </div>
        ))}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', color: '#10B981', fontSize: '0.8rem', fontWeight: 700 }}>
           <TrendingUp size={16} style={{ marginRight: '6px' }} /> Resultado Positivo
        </div>
      </div>
    </div>
  );
};

const ComissoesTab = ({ stats, barbers, currentUser, startDate, endDate }) => {
  const isBarberOnly = currentUser?.role === 'Barbeiro';
  const [filterBarberId, setFilterBarberId] = useState('all');

  const barbersById = useMemo(() => indexBarbersById(barbers), [barbers]);
  const selectableBarbers = useMemo(
    () => barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers]
  );

  const appointmentsScope = useMemo(() => {
    let apps = stats.appointments || [];
    if (!isBarberOnly && filterBarberId !== 'all') {
      const id = Number(filterBarberId);
      apps = apps.filter((a) => Number(a.barberId) === id);
    }
    return apps;
  }, [stats.appointments, isBarberOnly, filterBarberId]);

  const report = useMemo(
    () => buildCommissionReport(appointmentsScope, barbersById, { aggregateByBarber: true }),
    [appointmentsScope, barbersById]
  );

  const selectedBarber = useMemo(() => {
    if (filterBarberId === 'all') return null;
    return barbers.find((b) => Number(b.id) === Number(filterBarberId)) || null;
  }, [filterBarberId, barbers]);

  const barberSelfForPix = useMemo(() => {
    if (!isBarberOnly || !currentUser) return null;
    return barbers.find((b) => Number(b.id) === Number(currentUser.id)) || null;
  }, [isBarberOnly, currentUser, barbers]);

  return (
    <div className="fade-in">
      <SectionHeader
        title="Comissões e repasses (serviços)"
        subTitle={`Período: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')} · apenas agendamentos finalizados`}
        badge={`${report.totals.count} atendimento(s)`}
      />

      {!isBarberOnly && (
        <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Users size={18} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Profissional</span>
          <select
            value={filterBarberId}
            onChange={(e) => setFilterBarberId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              minWidth: '220px',
              fontWeight: 600,
            }}
          >
            <option value="all">Todos os profissionais</option>
            {selectableBarbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <KPICard title="Faturamento em serviços" value={formatCurrency(report.totals.totalService)} icon={Scissors} color="var(--kpi-revenue)" />
        <KPICard title="Retenção da casa (serviços)" value={formatCurrency(report.totals.totalHouse)} icon={Landmark} color="#6366f1" />
        <KPICard title="Repasse aos profissionais" value={formatCurrency(report.totals.totalBarber)} icon={Wallet} color="var(--kpi-commission)" />
        <KPICard title="Serviços finalizados" value={String(report.totals.count)} icon={LayoutList} color="var(--kpi-ticket)" />
      </div>

      {selectedBarber?.chave_pix && (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <QrCode size={22} color="var(--text-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Chave Pix — {selectedBarber.name}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, wordBreak: 'break-all' }}>{selectedBarber.chave_pix}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Vendas de produto não entram neste repasse até existir regra específica.</div>
          </div>
        </div>
      )}

      {barberSelfForPix?.chave_pix && (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <QrCode size={22} color="var(--text-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Sua chave Pix</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, wordBreak: 'break-all' }}>{barberSelfForPix.chave_pix}</div>
          </div>
        </div>
      )}

      {!isBarberOnly && filterBarberId === 'all' && report.byBarber.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Resumo por profissional</h3>
          <span className="table-scroll-hint">Deslize horizontalmente para ver todas as colunas.</span>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {['PROFISSIONAL', 'QTD.', 'FAT. SERVIÇOS', '% MÉDIO*', 'RETENÇÃO CASA', 'REPASSE'].map((h) => (
                    <th key={h} style={{ padding: '12px', textAlign: h === 'PROFISSIONAL' ? 'left' : 'right', fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.byBarber.map((row) => {
                  const avgPct = row.totalService > 0 ? (row.totalHouse / row.totalService) * 100 : 0;
                  return (
                    <tr key={row.barberId} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{row.barberName}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{row.count}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(row.totalService)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{avgPct.toFixed(1)}%</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(row.totalHouse)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(row.totalBarber)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '10px 0 0 0' }}>* Média ponderada implícita quando há vários percentuais no período.</p>
        </div>
      )}

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Detalhamento por atendimento</h3>
        <span className="table-scroll-hint">Deslize horizontalmente para ver todas as colunas.</span>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {[
                  { h: 'DATA', align: 'left' },
                  { h: 'CLIENTE', align: 'left' },
                  { h: 'SERVIÇO', align: 'left' },
                  { h: 'PROFISSIONAL', align: 'left' },
                  { h: 'VALOR', align: 'right' },
                  { h: '% CASA', align: 'right' },
                  { h: 'R$ CASA', align: 'right' },
                  { h: 'R$ REPASSE', align: 'right' },
                  { h: '', align: 'left' },
                ].map((col) => (
                  <th key={col.h || 'note'} style={{ padding: '12px', textAlign: col.align, fontWeight: 700 }}>
                    {col.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.appointmentId ?? `${r.date}-${r.customer}-${r.service}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{r.date.split('-').reverse().join('/')}</td>
                  <td style={{ padding: '12px' }}>{r.customer}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{r.service}</td>
                  <td style={{ padding: '12px' }}>{r.barberName}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.price)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {r.shopPct}%{r.usedDefaultCommission ? ' *' : ''}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.house)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(r.barberPayout)}</td>
                  <td style={{ padding: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{r.usedDefaultCommission ? 'padrão' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>Nenhum serviço finalizado no período</div>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '10px 0 0 0' }}>* Percentual padrão (50%) aplicado quando o profissional não foi encontrado no cadastro.</p>
      </div>
    </div>
  );
};

const ComparativoTab = ({ barbers, getFinancialStats }) => {
  const today = new Date();
  const [compMonthA, setCompMonthA] = useState(`${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`);
  const [compMonthB, setCompMonthB] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

  const barbersById = useMemo(() => indexBarbersById(barbers), [barbers]);

  const statsA = useMemo(
    () => getMonthFinancialSnapshot(compMonthA, getFinancialStats, barbersById),
    [compMonthA, getFinancialStats, barbersById]
  );
  const statsB = useMemo(
    () => getMonthFinancialSnapshot(compMonthB, getFinancialStats, barbersById),
    [compMonthB, getFinancialStats, barbersById]
  );

  const diffPct = statsA.revenue > 0 ? ((statsB.revenue - statsA.revenue) / statsA.revenue) * 100 : 0;

  const data = [
    { name: 'Receita Bruta', mesA: statsA.revenue, mesB: statsB.revenue },
    { name: 'Lucro Líquido', mesA: statsA.netProfit, mesB: statsB.netProfit },
    { name: 'Repasse profissionais', mesA: statsA.commissionValue, mesB: statsB.commissionValue },
    { name: 'Venda Prod.', mesA: statsA.productRevenue, mesB: statsB.productRevenue }
  ];

  return (
    <div className="fade-in">
      <div className="finance-comparativo-months">
        <div className="glass-card" style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mês A</div>
            <input type="month" value={compMonthA} onChange={e => setCompMonthA(e.target.value)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', fontWeight: 700, outline: 'none', color: 'var(--text-primary)' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(statsA.revenue)}</div>
          </div>
        </div>
        <div className="glass-card" style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--kpi-revenue)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mês B</div>
            <input type="month" value={compMonthB} onChange={e => setCompMonthB(e.target.value)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', fontWeight: 700, outline: 'none', color: 'var(--text-primary)' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--kpi-revenue)' }}>{formatCurrency(statsB.revenue)}</div>
            <div style={{ fontSize: '0.8rem', color: diffPct >= 0 ? '#10B981' : '#ef4444', fontWeight: 700 }}>
              {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}% vs Mês A
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card finance-chart-card finance-chart-card--tall">
         <SectionHeader title="Comparativo Mês a Mês" subTitle="Análise visual do crescimento" />
         <ResponsiveContainer width="100%" height="85%">
           <BarChart data={data}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
             <XAxis dataKey="name" axisLine={false} tickLine={false} />
             <YAxis axisLine={false} tickLine={false} hide />
             <Tooltip
               cursor={{ fill: 'rgba(0,0,0,0.02)' }}
               contentStyle={{ borderRadius: '12px', background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
               formatter={(value, name) => [formatCurrency(Number(value)), name]}
             />
             <Bar dataKey="mesA" fill="var(--brand-300)" radius={[4, 4, 0, 0]} name="Mês Anterior" />
             <Bar dataKey="mesB" fill="var(--kpi-revenue)" radius={[4, 4, 0, 0]} name="Mês Atual" />
           </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};

const RankingTab = ({ startDate, endDate, getBarberRanking }) => {
  const rankingData = useMemo(() => getBarberRanking(startDate, endDate), [startDate, endDate, getBarberRanking]);
  
  const radarData = useMemo(() => rankingData.slice(0, 3).map(b => ({
    subject: b.name,
    A: b.revenue,
    B: b.count * 50, // Scalling Qtd to match Revenue space
    fullMark: Math.max(...rankingData.map(x => x.revenue), 1)
  })), [rankingData]);

  return (
    <div className="fade-in">
      <SectionHeader title="Ranking de Barbeiros" subTitle="Performance individual dos profissionais" />
      <div className="finance-ranking-layout">
        <div className="glass-card" style={{ padding: '1.5rem' }}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             {rankingData.map((b, idx) => (
               <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', background: idx === 0 ? 'var(--kpi-revenue)' : (idx === 1 ? '#94a3b8' : '#cd7f32'), 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' 
                  }}>
                    <Trophy size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                     <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{b.name}</div>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                       {b.count} atendimentos  •  Ticket: {formatCurrency(b.averageTicket)}
                     </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatCurrency(b.revenue)}</div>
                     <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>Top Performance</div>
                  </div>
               </div>
             ))}
           </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2rem' }}>Análise Multidimensional (Top 3)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="var(--border-color)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <Radar name="Performance" dataKey="A" stroke="var(--kpi-revenue)" fill="var(--kpi-revenue)" fillOpacity={0.6} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equilíbrio entre Faturamento e Volume</div>
        </div>
      </div>
    </div>
  );
};

const DespesasTab = ({ stats, netProfit, repasseServicos, netMargin, onAdd, onEdit, onDelete }) => {
  return (
    <div className="fade-in">
      <div className="finance-despesas-layout">
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div className="finance-despesas-header">
            <SectionHeader title="Despesas Fixas" subTitle="Registro mensal de custos operacionais" />
            <button 
              className="btn-primary" 
              onClick={onAdd}
              style={{ height: 'fit-content', padding: '10px 20px', fontSize: '0.8rem' }}
            >
              + Adicionar
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             {stats.expensesList.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Nenhuma despesa cadastrada no período</div>
             ) : (
               stats.expensesList.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                     <div>
                       <div style={{ fontWeight: 700 }}>{e.description}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{e.category} • {e.date.split('-').reverse().join('/')}</div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                       <span style={{ fontWeight: 700, color: '#ef4444' }}>- {formatCurrency(e.amount)}</span>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => onEdit(e)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16}/></button>
                          <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                       </div>
                     </div>
                  </div>
               ))
             )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <SectionHeader title="Impacto no Resultado" subTitle="Como as despesas afetam o lucro" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             {[
               { label: 'Receita Bruta', val: stats.revenue, color: 'var(--text-primary)' },
               { label: '(-) Repasse profissionais (serviços)', val: repasseServicos, color: '#ef4444' },
               { label: '= Lucro bruto (após repasse e antes de despesas)', val: stats.revenue - repasseServicos, color: '#2563EB', isBold: true },
               { label: '(-) Despesas Fixas', val: stats.expenses, color: '#ef4444' },
               { label: '= EBITDA', val: netProfit, color: 'var(--kpi-revenue)', isBold: true }
             ].map(row => (
               <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: row.isBold ? 700 : 400 }}>{row.label}</span>
                 <span style={{ fontWeight: 700, color: row.color }}>{formatCurrency(row.val)}</span>
               </div>
             ))}
             <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--panel-bg)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Margem Líquida Atrapalhada?</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--kpi-revenue)' }}>{netMargin.toFixed(1)}%</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExtratoTab = ({ stats, barbers }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const allTransactions = useMemo(() => {
    const barbersById = indexBarbersById(barbers);
    const trans = [
      ...stats.appointments.map((a) => {
        const b = barbersById[Number(a.barberId)];
        const shopPct = getShopPercent(b);
        const { house, barber: repasseProf } = splitAppointmentCommission(a.price, shopPct);
        const barberLabel = b?.name ?? a.Barber?.name ?? a.barber?.name ?? '—';
        return {
          ...a,
          type: 'Serviço',
          desc: a.service,
          total: a.price,
          repasseProf,
          retencaoCasa: house,
          shopPct,
          barberLabel,
        };
      }),
      ...stats.sales.map((s) => ({
        ...s,
        type: 'Produto',
        desc: s.productName,
        total: s.price * s.quantity,
        repasseProf: 0,
        retencaoCasa: s.price * s.quantity,
        shopPct: null,
        barberLabel: 'Caixa Central',
      })),
    ];
    return trans
      .filter(
        (t) =>
          t.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.customer && t.customer.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [stats, searchTerm, barbers]);

  return (
    <div className="fade-in glass-card" style={{ padding: '2rem' }}>
      <SectionHeader title="Extrato de Vendas" subTitle="Serviços com repasse e retenção conforme % do profissional; produtos integram na retenção da casa neste extrato." />

      <div className="finance-extrato-toolbar">
         <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <Search size={18} style={{ position: 'absolute', left: '15px', top: '12px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" placeholder="Buscar cliente ou serviço..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 12px 12px 45px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
            />
         </div>
         <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '9999px', cursor: 'pointer', color: 'var(--text-primary)' }}>
           <Download size={16} /> Exportar
         </button>
      </div>

      <span className="table-scroll-hint">Deslize horizontalmente para ver todas as colunas.</span>
      <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {[
                { h: 'DATA', align: 'left' },
                { h: 'TIPO', align: 'left' },
                { h: 'DESCRIÇÃO', align: 'left' },
                { h: 'CLIENTE', align: 'left' },
                { h: 'BARBEIRO', align: 'left' },
                { h: 'TOTAL', align: 'right' },
                { h: '% CASA', align: 'right' },
                { h: 'REPASSE PROF.', align: 'right' },
                { h: 'RETENÇÃO CASA', align: 'right' },
              ].map((col) => (
                <th key={col.h} style={{ padding: '15px', textAlign: col.align, fontWeight: 700 }}>{col.h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTransactions.map((t, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <td style={{ padding: '15px', color: 'var(--text-secondary)' }}>{t.date.split('-').reverse().join('/')}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{ background: t.type === 'Serviço' ? '#10B98120' : '#8B5CF620', color: t.type === 'Serviço' ? '#10B981' : '#8B5CF6', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>{t.type}</span>
                </td>
                <td style={{ padding: '15px', fontWeight: 600 }}>{t.desc}</td>
                <td style={{ padding: '15px' }}>{t.customer || 'Venda Avulsa'}</td>
                <td style={{ padding: '15px' }}>{t.barberLabel}</td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.total)}</td>
                <td style={{ padding: '15px', textAlign: 'right', color: 'var(--text-secondary)' }}>{t.shopPct != null ? `${t.shopPct}%` : '—'}</td>
                <td style={{ padding: '15px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(t.repasseProf)}</td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 700, color: 'var(--kpi-revenue)' }}>{formatCurrency(t.retencaoCasa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allTransactions.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Nenhum registro encontrado</div>}
      </div>
    </div>
  );
};

const FechamentoTab = () => {
  const {
    barbers,
    currentUser,
    getFinancialStats,
    monthClosings,
    createMonthClosing,
    refreshMonthClosings,
    periodClosings,
    createPeriodClosing,
    refreshPeriodClosings,
  } = useApp();

  const isGerente = currentUser?.role === 'Gerente';

  const defaultYm = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [closingMonth, setClosingMonth] = useState(defaultYm);
  const [closingNotes, setClosingNotes] = useState('');
  const [monthBusy, setMonthBusy] = useState(false);
  const [monthErr, setMonthErr] = useState('');

  const [periodStart, setPeriodStart] = useState(() => {
    const t = new Date();
    return getLocalDateStr(new Date(t.getFullYear(), t.getMonth(), 1));
  });
  const [periodEnd, setPeriodEnd] = useState(() => getLocalDateStr(new Date()));
  const [periodScope, setPeriodScope] = useState('SHOP');
  const [periodBarberId, setPeriodBarberId] = useState('');
  const [periodNotes, setPeriodNotes] = useState('');
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodErr, setPeriodErr] = useState('');
  /** Linha do histórico cujo instantâneo está a ser visualizado no modal */
  const [periodHistoryDetail, setPeriodHistoryDetail] = useState(null);

  const selectableBarbers = useMemo(
    () => barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers]
  );

  useEffect(() => {
    if (currentUser?.role === 'Barbeiro') setPeriodScope('BARBER');
  }, [currentUser?.role]);

  const previewBarberFilter = useMemo(() => {
    if (currentUser?.role === 'Barbeiro') return null;
    if (periodScope === 'SHOP') return null;
    const id = Number(periodBarberId);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [currentUser?.role, periodScope, periodBarberId]);

  const previewStats = useMemo(() => {
    if (periodStart > periodEnd) return null;
    if (isGerente && periodScope === 'BARBER' && !previewBarberFilter) return null;
    return getFinancialStats(periodStart, periodEnd, previewBarberFilter);
  }, [periodStart, periodEnd, previewBarberFilter, getFinancialStats, isGerente, periodScope]);

  const previewBarbersById = useMemo(() => indexBarbersById(barbers), [barbers]);
  const previewCommission = useMemo(() => {
    if (!previewStats) return null;
    return buildCommissionReport(previewStats.appointments, previewBarbersById, { aggregateByBarber: false });
  }, [previewStats, previewBarbersById]);

  const previewNetProfit = previewStats && previewCommission
    ? previewStats.revenue - previewCommission.totals.totalBarber - previewStats.expenses - previewStats.productCost
    : null;

  const periodDuplicate = useMemo(() => {
    const scope = isGerente ? periodScope : 'BARBER';
    const bid = scope === 'SHOP' ? 0 : (isGerente ? Number(periodBarberId) : Number(currentUser?.id));
    if (scope === 'BARBER' && (!Number.isFinite(bid) || bid <= 0)) return null;
    return periodClosings.find(
      (c) => c.startDate === periodStart && c.endDate === periodEnd && c.scope === scope && Number(c.barberId) === bid
    );
  }, [periodClosings, periodStart, periodEnd, periodScope, periodBarberId, currentUser, isGerente]);

  const existingMonth = useMemo(
    () => monthClosings.find((c) => c.yearMonth === closingMonth),
    [monthClosings, closingMonth]
  );
  const snapMonth = existingMonth?.snapshot || null;

  const handleMonthRegister = async () => {
    setMonthErr('');
    setMonthBusy(true);
    try {
      await createMonthClosing({ yearMonth: closingMonth, notes: closingNotes });
      setClosingNotes('');
      await refreshMonthClosings();
    } catch (e) {
      setMonthErr(e.message || 'Erro ao registrar fechamento.');
    } finally {
      setMonthBusy(false);
    }
  };

  const handlePeriodRegister = async () => {
    setPeriodErr('');
    if (periodStart > periodEnd) {
      setPeriodErr('A data inicial não pode ser posterior à data final.');
      return;
    }
    if (isGerente && periodScope === 'BARBER' && !previewBarberFilter) {
      setPeriodErr('Seleccione um profissional para fechamento individual.');
      return;
    }
    setPeriodBusy(true);
    try {
      await createPeriodClosing({
        startDate: periodStart,
        endDate: periodEnd,
        scope: currentUser?.role === 'Barbeiro' ? 'BARBER' : periodScope,
        barberId: periodScope === 'BARBER' ? previewBarberFilter : undefined,
        notes: periodNotes,
      });
      setPeriodNotes('');
      await refreshPeriodClosings();
    } catch (e) {
      setPeriodErr(e.message || 'Erro ao registar fechamento.');
    } finally {
      setPeriodBusy(false);
    }
  };

  const formatClosedAt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };

  const formatIsoToPt = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    return iso.split('-').reverse().join('/');
  };

  return (
    <div className="fade-in">
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <SectionHeader
          title="Fechamento por período"
          subTitle="Escolha a data inicial e final (ex.: dia 5 ao dia 25). Pode registar o caixa da barbearia inteira ou, se for gestão, o de um profissional. O registo guarda um instantâneo para histórico."
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginTop: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Data inicial</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Data final</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
            />
          </div>
          {isGerente && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Âmbito</label>
                <select
                  value={periodScope}
                  onChange={(e) => {
                    setPeriodScope(e.target.value);
                    if (e.target.value === 'SHOP') setPeriodBarberId('');
                  }}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: '200px', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
                >
                  <option value="SHOP">Barbearia inteira</option>
                  <option value="BARBER">Um profissional</option>
                </select>
              </div>
              {periodScope === 'BARBER' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Profissional</label>
                  <select
                    value={periodBarberId}
                    onChange={(e) => setPeriodBarberId(e.target.value)}
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: '200px', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— Escolher —</option>
                    {selectableBarbers.map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Notas (opcional)</label>
            <input
              type="text"
              placeholder="Ex.: conferido com movimento do dia"
              value={periodNotes}
              onChange={(e) => setPeriodNotes(e.target.value)}
              disabled={!!periodDuplicate}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
            />
          </div>
          {!periodDuplicate && (
            <button
              type="button"
              className="btn-primary"
              disabled={periodBusy || !previewStats || previewCommission == null}
              onClick={handlePeriodRegister}
              style={{ padding: '12px 22px' }}
            >
              {periodBusy ? 'A gravar…' : 'Registar fechamento do período'}
            </button>
          )}
        </div>
        {periodErr && (
          <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 600 }}>{periodErr}</p>
        )}
        {periodDuplicate && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} /> Já existe fechamento para este período e âmbito em {formatClosedAt(periodDuplicate.closedAt)}
            {periodDuplicate.closedByName && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · {periodDuplicate.closedByName}</span>}
          </div>
        )}
        {previewStats && previewCommission && previewNetProfit != null && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Pré-visualização (dados actuais)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
              {[
                ['Receita', formatCurrency(previewStats.revenue)],
                ['Repasse prof.', formatCurrency(previewCommission.totals.totalBarber)],
                ['Retenção casa', formatCurrency(previewCommission.totals.totalHouse)],
                ['Despesas', formatCurrency(previewStats.expenses)],
                ['CPV produtos', formatCurrency(previewStats.productCost)],
                ['Lucro líquido', formatCurrency(previewNetProfit)],
                ['Atendimentos', String(previewStats.appointments?.length ?? 0)],
                ['Vendas produto', String(previewStats.sales?.length ?? 0)],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '10px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700 }}>{k}</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isGerente && periodScope === 'BARBER' && !previewBarberFilter && (
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Seleccione um profissional para ver a pré-visualização.</p>
        )}
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <SectionHeader title="Histórico — fechamentos por período" subTitle="Do mais recente ao mais antigo." />
        <span className="table-scroll-hint">Deslize horizontalmente se necessário.</span>
        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>PERÍODO</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>ÂMBITO</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>DATA REGISTO</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>RESPONSÁVEL</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>LUCRO LÍQ.</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>NOTAS</th>
                <th
                  scope="col"
                  style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, width: '44px' }}
                  aria-label="Detalhes do instantâneo guardado"
                  title="Detalhes do instantâneo"
                >
                  <PeriodClosingInfoSvg size={18} style={{ margin: '0 auto', color: '#1f1f1f' }} aria-hidden />
                </th>
              </tr>
            </thead>
            <tbody>
              {periodClosings.map((row) => {
                const s = row.snapshot || {};
                const ambito = row.scope === 'SHOP' ? 'Loja' : (s.barberName || `Barbeiro #${row.barberId}`);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '12px', fontWeight: 700 }}>{formatIsoToPt(row.startDate)} – {formatIsoToPt(row.endDate)}</td>
                    <td style={{ padding: '12px' }}>{ambito}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{formatClosedAt(row.closedAt)}</td>
                    <td style={{ padding: '12px' }}>{row.closedByName || '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(s.netProfit)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '240px' }}>{row.notes || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        aria-label="Ver detalhes do fechamento"
                        title="Receita, repasse, despesas e instantâneo"
                        onClick={() => setPeriodHistoryDetail(row)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          border: '1px solid #1f1f1f',
                          background: 'var(--panel-bg)',
                          color: '#1f1f1f',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <PeriodClosingInfoSvg size={18} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {periodClosings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Nenhum fechamento por período ainda.</div>
          )}
        </div>
      </div>

      {isGerente && (
        <>
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <SectionHeader
              title="Fechamento mensal (legado)"
              subTitle="Um registo por mês civil (YYYY-MM). Mantido para auditoria alinhada ao calendário."
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Mês (competência)</label>
                <input
                  type="month"
                  value={closingMonth}
                  onChange={(e) => setClosingMonth(e.target.value)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex.: conferido com extrato bancário"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  disabled={!!existingMonth}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }}
                />
              </div>
              {!existingMonth && (
                <button type="button" className="btn-primary" disabled={monthBusy} onClick={handleMonthRegister} style={{ padding: '12px 22px' }}>
                  {monthBusy ? 'A gravar…' : 'Registrar fechamento mensal'}
                </button>
              )}
            </div>
            {monthErr && (
              <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 600 }}>{monthErr}</p>
            )}
            {existingMonth && (
              <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontWeight: 700 }}>
                  <Lock size={18} /> Mês já fechado em {formatClosedAt(existingMonth.closedAt)}
                  {existingMonth.closedByName && <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · por {existingMonth.closedByName}</span>}
                </div>
                {existingMonth.notes && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{existingMonth.notes}</p>}
                {snapMonth && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                    {[
                      ['Período', `${snapMonth.startDate?.split('-').reverse().join('/')} – ${snapMonth.endDate?.split('-').reverse().join('/')}`],
                      ['Receita bruta', formatCurrency(snapMonth.revenue)],
                      ['Repasse profissionais', formatCurrency(snapMonth.repasseServicos)],
                      ['Retenção casa (serviços)', formatCurrency(snapMonth.retencaoCasaServicos)],
                      ['Despesas', formatCurrency(snapMonth.expenses)],
                      ['CPV produtos', formatCurrency(snapMonth.productCost)],
                      ['Lucro líquido', formatCurrency(snapMonth.netProfit)],
                      ['Margem %', `${Number(snapMonth.netMargin || 0).toFixed(1)}%`],
                      ['Atendimentos', String(snapMonth.appointmentCount ?? 0)],
                      ['Vendas produto', String(snapMonth.saleCount ?? 0)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '10px', background: 'var(--surface-color)', borderRadius: '8px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 700 }}>{k}</div>
                        <div style={{ fontWeight: 700, marginTop: '4px' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '2rem' }}>
            <SectionHeader title="Histórico — fechamentos mensais" subTitle="Todos os meses registados, do mais recente ao mais antigo." />
            <span className="table-scroll-hint">Deslize horizontalmente para ver todas as colunas.</span>
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>MÊS</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>DATA FECHO</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>RESPONSÁVEL</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>LUCRO LÍQ.</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700 }}>NOTAS</th>
                  </tr>
                </thead>
                <tbody>
                  {monthClosings.map((row) => {
                    const s = row.snapshot || {};
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{row.yearMonth}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{formatClosedAt(row.closedAt)}</td>
                        <td style={{ padding: '12px' }}>{row.closedByName || '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(s.netProfit)}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '280px' }}>{row.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {monthClosings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Nenhum fechamento mensal registado ainda.</div>
              )}
            </div>
          </div>
        </>
      )}

      {periodHistoryDetail && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPeriodHistoryDetail(null)}
        >
          <div
            className="modal-glass-panel fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="period-close-detail-title"
            style={{ width: '95%', maxWidth: '520px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const row = periodHistoryDetail;
              const snap = row.snapshot || {};
              const ambitoLabel = row.scope === 'SHOP' ? 'Barbearia inteira' : (snap.barberName || `Profissional #${row.barberId}`);
              const detailGrid = [
                ['Receita total', formatCurrency(snap.revenue)],
                ['Receita serviços', formatCurrency(snap.serviceRevenue)],
                ['Receita produtos', formatCurrency(snap.productRevenue)],
                ['Repasse profissionais (serviços)', formatCurrency(snap.repasseServicos)],
                ['Retenção casa (serviços)', formatCurrency(snap.retencaoCasaServicos)],
                ['Despesas (período)', formatCurrency(snap.expenses)],
                ['CPV produtos', formatCurrency(snap.productCost)],
                ['Lucro líquido', formatCurrency(snap.netProfit)],
                ['Margem líquida %', `${Number(snap.netMargin ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`],
                ['Ticket médio', formatCurrency(snap.averageTicket)],
                ['Atendimentos finalizados', String(snap.appointmentCount ?? 0)],
                ['Vendas de produto', String(snap.saleCount ?? 0)],
                ['Despesas registadas (linhas)', String(snap.expenseCount ?? 0)],
              ];
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 id="period-close-detail-title" style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>
                        Instantâneo do fechamento
                      </h2>
                      <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        {formatIsoToPt(row.startDate)} – {formatIsoToPt(row.endDate)} · {ambitoLabel}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Registado em {formatClosedAt(row.closedAt)}
                        {row.closedByName ? ` · ${row.closedByName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0, padding: '4px' }}
                      onClick={() => setPeriodHistoryDetail(null)}
                    >
                      <X size={22} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '0.85rem' }}>
                    {detailGrid.map(([k, v]) => (
                      <div key={k} style={{ padding: '12px', background: 'var(--panel-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 700 }}>{k}</div>
                        <div style={{ fontWeight: 700, marginTop: '6px' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {row.notes ? (
                    <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Notas:</strong> {row.notes}
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

const Finance = () => {
  const { 
    barbers, getFinancialStats, getBarberRanking, 
    currentUser, addExpense, removeExpense, updateExpense,
  } = useApp();

  const [timeRange, setTimeRange] = useState('Semana');
  const [activeTab, setActiveTab] = useState('Visão Geral');

  const financeTabIds = useMemo(() => {
    const base = ['Visão Geral', 'DRE', 'Comissões', 'Comparativo', 'Ranking', 'Despesas', 'Extrato', 'Fechamento'];
    return base;
  }, []);

  useEffect(() => {
    if (!financeTabIds.includes(activeTab)) {
      setActiveTab('Visão Geral');
    }
  }, [financeTabIds, activeTab]);

  // Modal State for Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Operacional' });

  // Global Date Logic
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date(today);

    if (timeRange === 'Semana') {
      const day = today.getDay() || 7;
      start.setDate(today.getDate() - (day - 1));
      end.setDate(start.getDate() + 6);
    } else if (timeRange === 'Mês') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (timeRange === 'Trimestre') {
      const quarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), quarter * 3, 1);
      end = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
    } else if (timeRange === 'Ano') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    } else {
      start = new Date(2020, 0, 1);
    }

    return { startDate: getLocalDateStr(start), endDate: getLocalDateStr(end) };
  }, [timeRange]);

  const stats = useMemo(() => getFinancialStats(startDate, endDate), [startDate, endDate, getFinancialStats]);

  const barbersById = useMemo(() => indexBarbersById(barbers), [barbers]);
  const commissionReport = useMemo(
    () => buildCommissionReport(stats.appointments, barbersById, { aggregateByBarber: false }),
    [stats.appointments, barbersById]
  );
  const repasseServicos = commissionReport.totals.totalBarber;
  const retencaoCasaServicos = commissionReport.totals.totalHouse;
  const netProfit = stats.revenue - repasseServicos - stats.expenses - stats.productCost;
  const netMargin = stats.revenue > 0 ? (netProfit / stats.revenue) * 100 : 0;

  const handleEditExpense = (e) => {
    setEditingExpenseId(e.id);
    setExpenseForm(e);
    setIsExpenseModalOpen(true);
  };

  const handleAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Operacional' });
    setIsExpenseModalOpen(true);
  };

  const currentTab = () => {
    switch (activeTab) {
      case 'Visão Geral':
        return <VisaoGeralTab stats={stats} startDate={startDate} endDate={endDate} netProfit={netProfit} repasseServicos={repasseServicos} retencaoCasaServicos={retencaoCasaServicos} netMargin={netMargin} />;
      case 'DRE':
        return <DRETab stats={stats} startDate={startDate} endDate={endDate} netProfit={netProfit} repasseServicos={repasseServicos} retencaoCasaServicos={retencaoCasaServicos} netMargin={netMargin} />;
      case 'Comissões':
        return <ComissoesTab stats={stats} barbers={barbers} currentUser={currentUser} startDate={startDate} endDate={endDate} />;
      case 'Comparativo':
        return <ComparativoTab barbers={barbers} getFinancialStats={getFinancialStats} />;
      case 'Ranking':
        return <RankingTab startDate={startDate} endDate={endDate} getBarberRanking={getBarberRanking} />;
      case 'Despesas':
        return <DespesasTab stats={stats} netProfit={netProfit} repasseServicos={repasseServicos} netMargin={netMargin} onAdd={handleAddExpense} onEdit={handleEditExpense} onDelete={removeExpense} />;
      case 'Extrato':
        return <ExtratoTab stats={stats} barbers={barbers} />;
      case 'Fechamento':
        return <FechamentoTab />;
      default:
        return null;
    }
  };

  return (
    <div className="fade-in finance-page">
      
      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-glass-panel fade-in" style={{ width: '95%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{editingExpenseId ? 'Editar Despesa' : 'Nova Despesa'}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setIsExpenseModalOpen(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Descrição" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }} />
              <input type="number" placeholder="Valor" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }} />
              <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)' }} />
              <button className="btn-primary" style={{ padding: '14px' }} onClick={() => { if(editingExpenseId) updateExpense(editingExpenseId, expenseForm); else addExpense(expenseForm); setIsExpenseModalOpen(false); }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '6px' }}>Financeiro</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Central de inteligência financeira da barbearia</p>
      </header>

      {/* FILTERS SECTION */}
      <div className="finance-time-range-wrap">
        {['Semana', 'Mês', 'Trimestre', 'Ano', 'Total'].map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setTimeRange(r)}
            className={`finance-time-range-btn${timeRange === r ? ' finance-time-range-btn--active' : ''}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* NAVIGATION TABS */}
      <div className="finance-tab-nav hide-scrollbar">
        {financeTabIds.map(tab => (
          <button 
            key={tab} onClick={() => setActiveTab(tab)}
            style={{ 
              padding: '12px 24px', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)', flexShrink: 0
            }}
          >
            {tab}
            {activeTab === tab && <div style={{ position: 'absolute', bottom: '-2px', left: 0, right: 0, height: '3px', background: 'var(--accent-color)', borderRadius: '3px' }} />}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {currentTab()}

    </div>
  );
};

export default Finance;
