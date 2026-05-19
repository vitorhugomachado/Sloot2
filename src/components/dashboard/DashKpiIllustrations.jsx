/** Ilustrações line-art dos cards KPI (mockup Soft UI). */
const stroke = '#1a1a1a';
const strokeMuted = '#9ca3af';
const blue = '#5d5fef';
const green = '#22c55e';

export function RevenueIllustration({ className = '' }) {
  const teal = '#14b8a6';
  const pink = '#ec4899';
  const orange = '#f59e0b';

  return (
    <svg className={className} viewBox="0 0 88 72" fill="none" aria-hidden>
      {/* Confetti */}
      <path d="M10 14 Q16 8 22 16" stroke={pink} strokeWidth="2" strokeLinecap="round" />
      <path d="M72 10 Q78 18 70 22" stroke={orange} strokeWidth="2" strokeLinecap="round" />
      <path d="M4 38 Q10 32 14 40" stroke={teal} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M80 36 Q86 30 82 42" stroke={blue} strokeWidth="1.8" strokeLinecap="round" />

      {/* Linha de crescimento */}
      <path
        d="M6 44 L20 34 L32 40 L50 24 L68 14 L78 8"
        stroke={blue}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M72 10 L78 8 L76 16" stroke={blue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Base */}
      <line x1="8" y1="58" x2="80" y2="58" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="58" x2="8" y2="58" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />

      {/* Nota */}
      <rect x="6" y="44" width="22" height="14" rx="2.5" fill="#ccfbf1" stroke={stroke} strokeWidth="1.8" />
      <rect x="9" y="47" width="16" height="8" rx="1.5" stroke={teal} strokeWidth="1.4" fill="none" />
      <circle cx="17" cy="51" r="2" fill={teal} />
      <circle cx="12" cy="51" r="1" fill={teal} />
      <circle cx="22" cy="51" r="1" fill={teal} />

      {/* Pilha 3 moedas */}
      <ellipse cx="34" cy="54" rx="9" ry="2.8" fill="#f3f4f6" stroke={stroke} strokeWidth="1.8" />
      <path d="M25 54 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="34" cy="50" rx="9" ry="2.8" fill="#fff" stroke={stroke} strokeWidth="1.8" />
      <path d="M25 50 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="34" cy="46" rx="9" ry="2.8" fill="#f3f4f6" stroke={stroke} strokeWidth="1.8" />

      {/* Pilha 5 moedas */}
      <ellipse cx="54" cy="54" rx="9" ry="2.8" fill="#f3f4f6" stroke={stroke} strokeWidth="1.8" />
      <path d="M45 54 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="54" cy="50" rx="9" ry="2.8" fill="#fff" stroke={stroke} strokeWidth="1.8" />
      <path d="M45 50 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="54" cy="46" rx="9" ry="2.8" fill="#f3f4f6" stroke={stroke} strokeWidth="1.8" />
      <path d="M45 46 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="54" cy="42" rx="9" ry="2.8" fill="#fff" stroke={stroke} strokeWidth="1.8" />
      <path d="M45 42 v-3.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="54" cy="38" rx="9" ry="2.8" fill="#f3f4f6" stroke={stroke} strokeWidth="1.8" />
    </svg>
  );
}

export function OccupancyCalendarIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 72" fill="none" aria-hidden>
      <rect x="8" y="14" width="48" height="52" rx="6" stroke={stroke} strokeWidth="1.8" fill="#fff" />
      <path d="M8 24 h48" stroke={stroke} strokeWidth="1.6" />
      <path d="M20 10 v8 M44 10 v8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <rect x="14" y="8" width="8" height="10" rx="2" stroke={stroke} strokeWidth="1.4" fill="#f9fafb" />
      <rect x="42" y="8" width="8" height="10" rx="2" stroke={stroke} strokeWidth="1.4" fill="#f9fafb" />
      <circle cx="22" cy="36" r="3" fill={blue} opacity="0.9" />
      <circle cx="32" cy="36" r="3" fill="#e5e7eb" />
      <circle cx="42" cy="36" r="3" fill="#e5e7eb" />
      <circle cx="22" cy="48" r="3" fill="#e5e7eb" />
      <circle cx="32" cy="48" r="3" fill={blue} opacity="0.7" />
      <circle cx="42" cy="48" r="3" fill="#e5e7eb" />
    </svg>
  );
}

export function CancellationIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 72 72" fill="none" aria-hidden>
      <circle cx="36" cy="36" r="22" stroke={stroke} strokeWidth="1.8" fill="#fef2f2" />
      <path d="M26 26 L46 46 M46 26 L26 46" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 58 Q18 48 28 52" stroke="#f59e0b" strokeWidth="2" fill="none" opacity="0.5" />
    </svg>
  );
}

export function TicketAverageIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 88 72" fill="none" aria-hidden>
      <line x1="6" y1="56" x2="82" y2="56" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="42" width="11" height="14" rx="2.5" fill="#fff" stroke={stroke} strokeWidth="1.8" />
      <rect x="25" y="28" width="11" height="28" rx="2.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
      <rect x="40" y="34" width="11" height="22" rx="2.5" fill="#fff" stroke={stroke} strokeWidth="1.8" />
      <rect x="55" y="20" width="11" height="36" rx="2.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
      <polyline
        points="15.5,38 30.5,24 45.5,28 60.5,14"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="38" r="3.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
      <circle cx="30.5" cy="24" r="3.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
      <circle cx="45.5" cy="28" r="3.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
      <circle cx="60.5" cy="14" r="3.5" fill={blue} stroke={stroke} strokeWidth="1.8" />
    </svg>
  );
}

export function UpcomingEmptyIllustration({ className = '' }) {
  const teal = '#14b8a6';
  const pink = '#ec4899';
  const orange = '#f59e0b';

  return (
    <svg className={className} viewBox="0 0 240 160" fill="none" aria-hidden>
      {/* Confetti */}
      <path d="M24 28 Q34 14 46 26" stroke={teal} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M196 22 Q208 36 200 48" stroke={pink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M48 52 Q38 42 52 34" stroke={orange} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <path d="M168 38 Q182 28 188 44" stroke={blue} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <path d="M210 72 Q222 62 218 78" stroke={teal} strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />

      {/* Mesa */}
      <line x1="28" y1="136" x2="212" y2="136" stroke={stroke} strokeWidth="2" strokeLinecap="round" />

      {/* Relógio */}
      <circle cx="62" cy="100" r="28" stroke={stroke} strokeWidth="1.8" fill="#fff" />
      <line x1="62" y1="78" x2="62" y2="74" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="84" y1="100" x2="88" y2="100" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="62" y1="122" x2="62" y2="126" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="40" y1="100" x2="36" y2="100" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="73" y1="81" x2="75" y2="79" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="81" y1="89" x2="83" y2="87" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="81" y1="111" x2="83" y2="113" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="73" y1="119" x2="75" y2="121" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="51" y1="119" x2="49" y2="121" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="43" y1="111" x2="41" y2="113" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="43" y1="89" x2="41" y2="87" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="51" y1="81" x2="49" y2="79" stroke={strokeMuted} strokeWidth="1" strokeLinecap="round" />
      <line x1="62" y1="100" x2="62" y2="82" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="100" x2="78" y2="100" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="62" cy="100" r="2.5" fill={stroke} />

      {/* Calendário de mesa — argolas */}
      <circle cx="114" cy="46" r="3.5" stroke={strokeMuted} strokeWidth="1.6" fill="#f3f4f6" />
      <circle cx="128" cy="46" r="3.5" stroke={strokeMuted} strokeWidth="1.6" fill="#f3f4f6" />
      <circle cx="142" cy="46" r="3.5" stroke={strokeMuted} strokeWidth="1.6" fill="#f3f4f6" />
      <line x1="114" y1="46" x2="114" y2="54" stroke={strokeMuted} strokeWidth="1.4" />
      <line x1="128" y1="46" x2="128" y2="54" stroke={strokeMuted} strokeWidth="1.4" />
      <line x1="142" y1="46" x2="142" y2="54" stroke={strokeMuted} strokeWidth="1.4" />

      {/* Cabeçalho azul */}
      <rect x="98" y="54" width="60" height="14" rx="3" fill={blue} />
      <rect x="98" y="54" width="60" height="14" rx="3" stroke={stroke} strokeWidth="1.4" fill="none" opacity="0.15" />

      {/* Página com grelha 4×4 */}
      <rect x="98" y="68" width="60" height="52" rx="3" stroke={stroke} strokeWidth="1.8" fill="#fff" />
      <line x1="104" y1="84" x2="152" y2="84" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="104" y1="94" x2="152" y2="94" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="104" y1="104" x2="152" y2="104" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="116" y1="74" x2="116" y2="114" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="128" y1="74" x2="128" y2="114" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="140" y1="74" x2="140" y2="114" stroke="#e5e7eb" strokeWidth="1" />

      {/* Base triangular */}
      <path d="M118 120 L128 132 L138 120 Z" stroke={stroke} strokeWidth="1.6" fill="#f9fafb" strokeLinejoin="round" />

      {/* Planta — vaso + folhas */}
      <path
        d="M176 128 L198 128 L194 114 L180 114 Z"
        stroke={stroke}
        strokeWidth="1.6"
        fill="#f3f4f6"
        strokeLinejoin="round"
      />
      <path d="M186 114 Q178 98 172 88" stroke={green} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M188 114 Q192 94 202 86" stroke={green} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M190 114 Q198 102 206 96" stroke={green} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
      <ellipse cx="172" cy="88" rx="5" ry="8" fill={green} opacity="0.35" transform="rotate(-25 172 88)" />
      <ellipse cx="202" cy="86" rx="5" ry="8" fill={green} opacity="0.35" transform="rotate(20 202 86)" />
      <ellipse cx="206" cy="96" rx="4" ry="7" fill={green} opacity="0.3" transform="rotate(35 206 96)" />
    </svg>
  );
}
