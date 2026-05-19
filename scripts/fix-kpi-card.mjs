import { readFileSync, writeFileSync } from 'fs';

const path = 'src/pages/Dashboard.jsx';
let t = readFileSync(path, 'utf8');

const start = t.search(/<(?:motion\.)?div className="dash-kpi-(?:bottom|main)">/);
const end = t.indexOf('/* ─────────── Mini Calendar', start);
if (start < 0 || end < 0) {
  console.error('not found', start, end);
  process.exit(1);
}

const lines = [
  '      <motion.div className="dash-kpi-main">',
  '        <motion.div className="dash-kpi-data">',
  '          <motion.div className="dash-kpi-value">{value}</motion.div>',
  '          {trend !== undefined && (',
  "            <span className={`dash-kpi-trend ${isPositive ? 'up' : 'down'}`}>",
  "              {trend > 0 ? '+' : ''}{trend}% {trendLabel || 'vs último período'}",
  '            </span>',
  '          )}',
  '        </motion.div>',
  '        {illustration && (',
  '          <motion.div className="dash-kpi-illustration" aria-hidden>',
  '            {illustration}',
  '          </motion.div>',
  '        )}',
  '      </motion.div>',
  '    </motion.div>',
  '  );',
  '};',
  '',
].join('\n');

const block = lines.replaceAll('motion.div', 'div');

t = t.slice(0, start) + block + t.slice(end);
writeFileSync(path, t);
console.log('fixed kpi card');
