import { useMemo } from 'react';

const fmtMoney = (v, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(v ?? 0);
  } catch {
    return `$${Math.round(v ?? 0).toLocaleString()}`;
  }
};

const fmtMoneyPrecise = (v, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(v ?? 0);
  } catch {
    return `$${(v ?? 0).toFixed(2)}`;
  }
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtMonth = (ym) => {
  const [y, m] = ym.split('-');
  return `${MONTH_LABELS[+m - 1]} ${y.slice(2)}`;
};

export default function PaymentsView({ payments }) {
  const { totals, months, topBuyers, statusBreakdown, currency } = payments;
  const feeRate = totals.gross > 0 ? (totals.fees / totals.gross) * 100 : 0;
  const refundRate = totals.gross > 0 ? (totals.refund / totals.gross) * 100 : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950">
      <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Gross Revenue"  value={fmtMoney(totals.gross, currency)}  accent="text-emerald-400" />
          <Kpi label="Net Revenue"    value={fmtMoney(totals.net, currency)}    accent="text-blue-400" />
          <Kpi label="Total Fees"     value={fmtMoney(totals.fees, currency)}   accent="text-amber-400"
               sub={`${feeRate.toFixed(1)}% of gross`} />
          <Kpi label="Orders"         value={totals.orderCount.toLocaleString()} accent="text-violet-400" />
          <Kpi label="Avg Order"      value={fmtMoneyPrecise(totals.avgOrder, currency)} accent="text-cyan-400" />
          <Kpi label="Refunds"        value={fmtMoney(totals.refund, currency)} accent="text-rose-400"
               sub={refundRate > 0 ? `${refundRate.toFixed(1)}% of gross` : 'none'} />
        </div>

        {/* Monthly revenue chart */}
        <Panel title="Monthly Revenue">
          {months.length > 0
            ? <MonthlyChart months={months} currency={currency} />
            : <Empty>No dated rows in range.</Empty>}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top buyers */}
          <div className="lg:col-span-2">
            <Panel title="Top Buyers">
              {topBuyers.length > 0
                ? <TopBuyersTable buyers={topBuyers} currency={currency} />
                : <Empty>No rows.</Empty>}
            </Panel>
          </div>

          {/* Status breakdown */}
          <Panel title="Status">
            {statusBreakdown.length > 0
              ? <StatusBreakdown rows={statusBreakdown} total={totals.orderCount} />
              : <Empty>No rows.</Empty>}
          </Panel>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Kpi({ label, value, accent, sub }) {
  return (
    <div className="rounded-lg bg-slate-800/80 border border-slate-700/60 px-3 py-2.5 flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate-400 leading-none">{label}</span>
      <span className={`text-2xl font-bold tabular-nums mt-1.5 ${accent}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-500 mt-0.5">{sub}</span>}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-xl bg-slate-900/70 border border-slate-700/60 p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-slate-500 py-4 text-center">{children}</p>;
}

function MonthlyChart({ months, currency }) {
  // Layout constants
  const W = 720, H = 240;
  const padL = 56, padR = 16, padT = 12, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxGross = Math.max(1, ...months.map(m => m.gross));
  const barGap = 4;
  const barW = Math.max(6, (innerW / months.length) - barGap);

  // Y-axis ticks: 0, 25%, 50%, 75%, 100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: padT + innerH - innerH * t,
    label: fmtMoney(maxGross * t, currency),
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={t.y} y2={t.y}
                  stroke="rgba(148,163,184,0.15)" strokeDasharray="2 3" />
            <text x={padL - 8} y={t.y + 4} textAnchor="end"
                  className="fill-slate-500" style={{ fontSize: 10 }}>
              {t.label}
            </text>
          </g>
        ))}

        {/* Bars: gross outline, net solid */}
        {months.map((m, i) => {
          const x = padL + i * (barW + barGap);
          const grossH = (m.gross / maxGross) * innerH;
          const netH   = (m.net   / maxGross) * innerH;
          return (
            <g key={m.month}>
              {/* Gross (background bar) */}
              <rect x={x} y={padT + innerH - grossH}
                    width={barW} height={grossH}
                    fill="rgba(52,211,153,0.22)" rx="2" />
              {/* Net (foreground) */}
              <rect x={x} y={padT + innerH - netH}
                    width={barW} height={netH}
                    fill="rgb(96,165,250)" rx="2" />
              <title>
                {`${fmtMonth(m.month)}\nGross: ${fmtMoneyPrecise(m.gross, currency)}\nNet: ${fmtMoneyPrecise(m.net, currency)}\nOrders: ${m.count}`}
              </title>
            </g>
          );
        })}

        {/* X-axis labels */}
        {months.map((m, i) => {
          if (months.length > 18 && i % 2 !== 0) return null; // thin labels when crowded
          const x = padL + i * (barW + barGap) + barW / 2;
          return (
            <text key={m.month} x={x} y={H - padB + 14} textAnchor="middle"
                  className="fill-slate-500" style={{ fontSize: 10 }}>
              {fmtMonth(m.month)}
            </text>
          );
        })}
      </svg>

      <div className="flex gap-4 mt-2 px-2 text-xs">
        <Legend color="rgba(52,211,153,0.6)" label="Gross" />
        <Legend color="rgb(96,165,250)"      label="Net" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-slate-400">{label}</span>
    </div>
  );
}

function TopBuyersTable({ buyers, currency }) {
  const maxGross = Math.max(...buyers.map(b => b.gross));
  return (
    <div className="flex flex-col gap-1">
      {buyers.map((b, i) => {
        const pct = (b.gross / maxGross) * 100;
        return (
          <div key={b.buyer + i} className="flex items-center gap-3 text-xs">
            <span className="text-slate-600 w-5 text-right tabular-nums">{i + 1}</span>
            <span className="w-44 truncate text-slate-200" title={b.buyer}>{b.buyer}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 text-right tabular-nums text-slate-200">{fmtMoneyPrecise(b.gross, currency)}</span>
            <span className="w-12 text-right tabular-nums text-slate-500">{b.count}×</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusBreakdown({ rows, total }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(({ status, count }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={status} className="flex items-center gap-2 text-xs">
            <span className="flex-1 text-slate-200 uppercase tracking-wide">{status}</span>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-12 text-right tabular-nums text-slate-300">{count.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
