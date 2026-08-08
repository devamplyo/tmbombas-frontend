import { useId, useState } from 'react';
import { brl } from '@/lib/format';
import styles from './SupplierSpendingChart.module.css';

const W = 560;
const ROW_H = 30;
const PAD = { top: 6, right: 12, bottom: 6, left: 132 };

/** Rectangle with a rounded corner only at the right end (horizontal bar, base flush left). */
function rightRoundedRect(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, h / 2, w));
  if (w <= 0) return '';
  return `M${x},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x},${y + h} Z`;
}

function truncate(name, max = 16) {
  if (!name) return '—';
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * Horizontal bar chart: spending by supplier.
 * suppliers: [{ id, name, totalSpent, launchCount }]
 */
export default function SupplierSpendingChart({ suppliers = [] }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const uid = useId();

  if (!suppliers.length) {
    return <div className={styles.empty}>Sem gastos com fornecedores no período selecionado.</div>;
  }

  const sorted = [...suppliers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 8);
  const H = PAD.top + PAD.bottom + sorted.length * ROW_H;
  // the left gutter follows the current longest name, instead of always
  // reserving worst-case space — for a short name the bar starts much sooner.
  const longest = Math.max(...sorted.map((s) => truncate(s.name).length));
  const left = Math.min(PAD.left, Math.max(56, 8 + longest * 5.6 + 12));
  const innerW = W - left - PAD.right;
  const maxVal = Math.max(1, ...sorted.map((s) => s.totalSpent));
  const active = hover ?? pinned;

  const click = (i) => (e) => {
    e.stopPropagation();
    setPinned((prev) => (prev === i ? null : i));
  };

  return (
    <div className={styles.chartBox}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        style={{ height: H }}
        role="img"
        aria-label="Gastos por fornecedor"
        onClick={() => setPinned(null)}
      >
        {sorted.map((s, i) => {
          const y = PAD.top + i * ROW_H;
          const barH = ROW_H - 10;
          const w = (s.totalSpent / maxVal) * innerW;
          const isActive = active === i;

          return (
            <g key={`${s.id}-${uid}`}>
              <text x={8} y={y + barH / 2 + 4} textAnchor="start" className={styles.rowLabel}>
                {truncate(s.name)}
              </text>
              <path
                d={rightRoundedRect(left, y, w, barH, 4)}
                className={[styles.bar, isActive && styles.barActive, pinned === i && styles.barPinned]
                  .filter(Boolean).join(' ')}
              />
              <rect
                x={left}
                y={y}
                width={innerW}
                height={ROW_H}
                fill="transparent"
                className={styles.hitArea}
                tabIndex={0}
                role="button"
                aria-label={`${s.name}: ${brl(s.totalSpent)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={click(i)}
              />
            </g>
          );
        })}
      </svg>

      {active != null && (() => {
        const ratio = sorted[active].totalSpent / maxVal;
        // long bar (little space left) -> anchor to the right edge instead of following the tip
        const horizontal = ratio <= 0.7
          ? { left: `${((left + ratio * innerW + 8) / W) * 100}%` }
          : { right: '4px' };

        // row near the end of the chart -> the tooltip grows upward instead of overflowing below the card
        const rowTop = PAD.top + active * ROW_H;
        const rowBottom = rowTop + ROW_H;
        const vertical = H - rowBottom < 70
          ? { bottom: `${H - rowBottom + 4}px` }
          : { top: `${rowTop}px` };

        return (
          <div
            className={[styles.tooltip, pinned === active && styles.tooltipPinned].filter(Boolean).join(' ')}
            style={{ ...vertical, ...horizontal }}
          >
            <div className={styles.tooltipName}>{sorted[active].name}</div>
            <strong>{brl(sorted[active].totalSpent)}</strong>
            <span className={styles.tooltipHint}>
              {sorted[active].launchCount} lançamento{sorted[active].launchCount === 1 ? '' : 's'}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
