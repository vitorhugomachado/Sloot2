import { readFileSync, writeFileSync } from 'fs';

const path = 'src/pages/Dashboard.jsx';
let t = readFileSync(path, 'utf8');

if (!t.includes('DashUpcomingEmpty')) {
  t = t.replace(
    "import OccupancyGauge from '../components/OccupancyGauge';",
    `import OccupancyGauge from '../components/OccupancyGauge';
import DashUpcomingEmpty from '../components/dashboard/DashUpcomingEmpty';
import {
  RevenueIllustration,
  CancellationIllustration,
  TicketAverageIllustration,
} from '../components/dashboard/DashKpiIllustrations';`
  );
  t = t.replace(
    /import \{ Users, Calendar, Banknote, Clock, X, ShoppingBag, Plus, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, ArrowUpRight, BarChart3, Play, CheckCircle, XCircle \}/,
    'import { Users, Calendar, Clock, X, ShoppingBag, Plus, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Play, CheckCircle, XCircle }'
  );
}

const kpiStart = t.indexOf('const KpiCard = ');
const kpiEnd = t.indexOf('const MiniCalendar', kpiStart);
const kpiCard = `const KpiCard = ({ label, value, trend, trendLabel, illustration, stagger, invertTrend }) => {
  const isPositive = invertTrend ? trend <= 0 : trend >= 0;
  return (
    <TAG className={\`dash-kpi-card stagger-\${stagger}\`}>
      <TAG className="dash-kpi-top">
        <span className="dash-kpi-label">{label}</span>
        <TAG className="dash-kpi-arrow"><ChevronRight size={14} /></TAG>
      </TAG>
      <TAG className="dash-kpi-main">
        <TAG className="dash-kpi-data">
          <TAG className="dash-kpi-value">{value}</TAG>
          {trend !== undefined && (
            <span className={\`dash-kpi-trend \${isPositive ? 'up' : 'down'}\`}>
              {trend > 0 ? '+' : ''}{trend}% {trendLabel || 'vs último período'}
            </span>
          )}
        </TAG>
        {illustration && (
          <TAG className="dash-kpi-illustration" aria-hidden>
            {illustration}
          </TAG>
        )}
      </TAG>
    </TAG>
  );
};

`.replace(/<TAG/g, '<motion.div').replace(/<\/TAG>/g, '</motion.div>').replace(/<\/?motion\.div>/g, (s) => s.replace('motion.', ''));

t = t.slice(0, kpiStart) + kpiCard + t.slice(kpiEnd);

const activityStart = t.indexOf('\n        <div className="dash-panel dash-panel-activity">');
const kpiRowIdx = t.indexOf('KPI ROW');

if (activityStart > 0 && activityStart < kpiRowIdx) {
  const activityEnd = t.indexOf('\n      {/*', activityStart);
  let activityBlock = t.slice(activityStart, activityEnd);
  activityBlock = '\n        {/* Col 2: Atividade Recente */}' + activityBlock;

  const agendamentoClose = t.indexOf('> Agendamento\n          </button>') + '> Agendamento\n          </button>'.length;
  t = t.slice(0, agendamentoClose) + '\n        </div>\n      </motion.div>\n'.replace(/<\/?motion\.div>/g, (s) => s.replace('motion.', '')) + t.slice(activityEnd);

  const upcomingIdx = t.indexOf('dash-panel-upcoming');
  const insertAt = t.lastIndexOf('\n', upcomingIdx);
  t = t.slice(0, insertAt + 1) + activityBlock + '\n' + t.slice(insertAt + 1);
}

t = t.replace('iconEl={<Banknote size={22} />} iconClass="green"', 'illustration={<RevenueIllustration />}');
t = t.replace('iconEl={<XCircle size={22} />} iconClass="amber"', 'illustration={<CancellationIllustration />}');
t = t.replace('iconEl={<BarChart3 size={22} />} iconClass="slate"', 'illustration={<TicketAverageIllustration />}');

t = t.replace(
  /<div className="dash-empty-illustration">[\s\S]*?<\/div>\s*\) : \(/,
  '<DashUpcomingEmpty />\n            ) : ('
);

if (!t.includes('dash-page__inner')) {
  t = t.replace('<div className="dash-page">', '<div className="dash-page">\n      <div className="dash-page__inner">');
  const modalIdx = t.indexOf('      {actionModal.open');
  if (modalIdx > 0) t = t.slice(0, modalIdx) + '      </div>\n\n' + t.slice(modalIdx);
}

writeFileSync(path, t);
console.log('applied');
