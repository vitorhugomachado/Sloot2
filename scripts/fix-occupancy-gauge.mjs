import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/OccupancyGauge.jsx';
let t = readFileSync(path, 'utf8');

if (!t.includes('OccupancyCalendarIllustration')) {
  t = t.replace(
    "import { ChevronRight } from 'lucide-react';",
    "import { ChevronRight } from 'lucide-react';\nimport { OccupancyCalendarIllustration } from './dashboard/DashKpiIllustrations';"
  );
}

const start = t.indexOf('      <div className="dash-occ-body">');
const end = t.indexOf('    </div>\n  );\n};');
const block = `      <TAG className="dash-kpi-main dash-occ-layout">
        <TAG className="dash-kpi-data">
          <TAG className="dash-kpi-value">{Math.round(displayValue)}%</TAG>
          <TAG className="dash-occ-bar-track" role="progressbar" aria-valuenow={Math.round(displayValue)} aria-valuemin={0} aria-valuemax={100} aria-label="Taxa de ocupação">
            <TAG
              className="dash-occ-bar-fill"
              style={{ width: \`\${animatedPct}%\` }}
            />
          </TAG>
          {trendNumber !== null && (
            <span className={\`dash-kpi-trend \${trendNumber >= 0 ? 'up' : 'down'}\`}>
              {trendNumber > 0 ? '+' : ''}{trendNumber}% {trendLabel}
            </span>
          )}
        </TAG>
        <TAG className="dash-kpi-illustration" aria-hidden>
          <OccupancyCalendarIllustration />
        </TAG>
      </TAG>`;

const clean = block.replace(/<TAG/g, '<div').replace(/<\/TAG>/g, '</motion.div>').replace(/<\/motion\.motion.div>/g, '</div>').replace(/<\/motion\.motion.div>/g, '</div>');

const clean2 = block.replace(/<TAG/g, '<motion.div').replace(/<\/TAG>/g, '</motion.div>');
// simpler
const body = `      <div className="dash-kpi-main dash-occ-layout">
        <div className="dash-kpi-data">
          <div className="dash-kpi-value">{Math.round(displayValue)}%</div>
          <div className="dash-occ-bar-track" role="progressbar" aria-valuenow={Math.round(displayValue)} aria-valuemin={0} aria-valuemax={100} aria-label="Taxa de ocupação">
            <div
              className="dash-occ-bar-fill"
              style={{ width: \`\${animatedPct}%\` }}
            />
          </div>
          {trendNumber !== null && (
            <span className={\`dash-kpi-trend \${trendNumber >= 0 ? 'up' : 'down'}\`}>
              {trendNumber > 0 ? '+' : ''}{trendNumber}% {trendLabel}
            </span>
          )}
        </div>
        <div className="dash-kpi-illustration" aria-hidden>
          <OccupancyCalendarIllustration />
        </div>
      </div>
    </div>
  );
};

export default OccupancyGauge;
`;

if (start >= 0 && end >= 0) {
  t = t.slice(0, start) + body;
}

writeFileSync(path, t);
console.log('gauge ok');
