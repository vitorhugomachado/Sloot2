import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const OccupancyGauge = ({ value = 0, label = 'Ocupação', subtitle, stagger = 2 }) => {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  const [animatedPct, setAnimatedPct] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef(null);
  const startedAtRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = displayValue;
    startedAtRef.current = null;

    const tick = (timestamp) => {
      if (startedAtRef.current === null) startedAtRef.current = timestamp;
      const elapsed = timestamp - startedAtRef.current;
      const duration = 1100;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const next = fromRef.current + (safeValue - fromRef.current) * eased;

      setDisplayValue(next);
      setAnimatedPct(next);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue]);

  return (
    <div className={`dash-gauge-card stagger-${stagger}`}>
      <div className="dash-kpi-top">
        <span className="dash-kpi-label">{label}</span>
        <div className="dash-kpi-arrow"><ChevronRight size={14} /></div>
      </div>

      <div className="dash-kpi-main dash-occ-layout">
        <div className="dash-kpi-data">
          <div className="dash-kpi-value">{Math.round(displayValue)}%</div>
          {subtitle && <div className="dash-kpi-subtitle">{subtitle}</div>}
          <div className="dash-occ-bar-track" role="progressbar" aria-valuenow={Math.round(displayValue)} aria-valuemin={0} aria-valuemax={100} aria-label="Taxa de ocupação">
            <div
              className="dash-occ-bar-fill"
              style={{ width: `${animatedPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OccupancyGauge;
