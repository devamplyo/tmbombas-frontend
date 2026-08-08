import { useId, useState } from 'react';
import { brl, brlCompact, periodLabel } from '@/lib/format';
import styles from './FlowBarChart.module.css';

const W = 640;
const H = 200;
const PAD = { top: 10, right: 8, bottom: 24, left: 44 };

const SERIES_LABEL = { entradas: 'entradas', saidas: 'saídas' };

/** Rectangle with rounded corners only at the top (flat base, sitting on the baseline). */
function topRoundedRect(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  const bottom = y + h;
  if (h <= 0) return '';
  return `M${x},${bottom} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${bottom} Z`;
}

const sameBar = (a, b) => a && b && a.i === b.i && a.series === b.series;

/**
 * Grouped bar chart: Inflows x Outflows by period.
 * Each bar is individually clickable (pins the tooltip) and reacts to hover.
 * data: [{ periodo, entradas, saidas }]
 */
export default function FlowBarChart({ periods = [], granularidade = 'MES' }) {
  const [hover, setHover] = useState(null); // {i, series} — transient
  const [pinned, setPinned] = useState(null); // {i, series} — pinned by clicking
  const uid = useId();

  if (!periods.length) {
    return <div className={styles.empty}>Sem lançamentos financeiros no período selecionado.</div>;
  }

  const active = hover || pinned;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + innerH;

  const maxVal = Math.max(1, ...periods.map((p) => Math.max(p.entradas, p.saidas)));
  const bandW = innerW / periods.length;
  const groupW = bandW * 0.62;
  const barGap = 2;
  const barW = Math.min(24, (groupW - barGap) / 2);

  const scaleY = (v) => (v / maxVal) * innerH;

  const barX = (i, series) => {
    const groupX = PAD.left + bandW * i + (bandW - groupW) / 2;
    return series === 'entradas' ? groupX : groupX + barW + barGap;
  };

  const clickBar = (i, series) => (e) => {
    e.stopPropagation();
    setPinned((prev) => (sameBar(prev, { i, series }) ? null : { i, series }));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={[styles.dot, styles.entradas].join(' ')} />
          Entradas
        </span>
        <span className={styles.legendItem}>
          <span className={[styles.dot, styles.saidas].join(' ')} />
          Saídas
        </span>
      </div>

      <div className={styles.chartBox}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          role="img"
          aria-label="Entradas e saídas por período"
          onClick={() => setPinned(null)}
        >
          {/* gridlines */}
          {[0, 0.5, 1].map((f) => {
            const y = baseline - innerH * f;
            return (
              <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className={styles.gridline} />
            );
          })}
          <text x={PAD.left - 8} y={baseline + 4} textAnchor="end" className={styles.axisLabel}>0</text>
          <text x={PAD.left - 8} y={PAD.top + 8} textAnchor="end" className={styles.axisLabel}>
            {brlCompact(maxVal)}
          </text>

          {periods.map((p, i) => {
            const xEntradas = barX(i, 'entradas');
            const xSaidas = barX(i, 'saidas');
            const hEntradas = scaleY(p.entradas);
            const hSaidas = scaleY(p.saidas);

            return (
              <g key={`${p.periodo}-${uid}`}>
                {hEntradas > 0 && (
                  <path
                    d={topRoundedRect(xEntradas, baseline - hEntradas, barW, hEntradas, 4)}
                    className={[
                      styles.barEntradas,
                      sameBar(active, { i, series: 'entradas' }) && styles.barActive,
                      sameBar(pinned, { i, series: 'entradas' }) && styles.barPinned,
                    ].filter(Boolean).join(' ')}
                  />
                )}
                {hSaidas > 0 && (
                  <path
                    d={topRoundedRect(xSaidas, baseline - hSaidas, barW, hSaidas, 4)}
                    className={[
                      styles.barSaidas,
                      sameBar(active, { i, series: 'saidas' }) && styles.barActive,
                      sameBar(pinned, { i, series: 'saidas' }) && styles.barPinned,
                    ].filter(Boolean).join(' ')}
                  />
                )}

                <text
                  x={PAD.left + bandW * i + bandW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className={styles.axisLabel}
                >
                  {periodLabel(p.periodo, granularidade)}
                </text>

                {/* individual click/hover target for each bar — covers the whole column height,
                    to make it easy to hit even when the value is low */}
                <rect
                  x={xEntradas}
                  y={PAD.top}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                  className={styles.hitArea}
                  tabIndex={0}
                  role="button"
                  aria-label={`${periodLabel(p.periodo, granularidade)}: entradas ${brl(p.entradas)}`}
                  onMouseEnter={() => setHover({ i, series: 'entradas' })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ i, series: 'entradas' })}
                  onBlur={() => setHover(null)}
                  onClick={clickBar(i, 'entradas')}
                />
                <rect
                  x={xSaidas}
                  y={PAD.top}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                  className={styles.hitArea}
                  tabIndex={0}
                  role="button"
                  aria-label={`${periodLabel(p.periodo, granularidade)}: saídas ${brl(p.saidas)}`}
                  onMouseEnter={() => setHover({ i, series: 'saidas' })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ i, series: 'saidas' })}
                  onBlur={() => setHover(null)}
                  onClick={clickBar(i, 'saidas')}
                />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className={[styles.tooltip, pinned && sameBar(pinned, active) && styles.tooltipPinned]
              .filter(Boolean).join(' ')}
            style={{ left: `${((barX(active.i, active.series) + barW / 2) / W) * 100}%` }}
          >
            <div className={styles.tooltipPeriod}>{periodLabel(periods[active.i].periodo, granularidade)}</div>
            <div className={styles.tooltipRow}>
              <span className={[styles.key, styles[active.series]].join(' ')} />
              <strong>{brl(periods[active.i][active.series])}</strong>
              <span className={styles.tooltipLabel}>{SERIES_LABEL[active.series]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
