import { useCallback, useRef } from 'react';

function toDay(iso) {
  if (!iso) return 0;
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 86400000);
}

function fromDay(day) {
  const d = new Date(day * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1];
  return `${mon} ${+d}, ${y}`;
}

export default function DateRangeFilter({ min, max, from, to, onChange }) {
  const minDay = toDay(min);
  const maxDay = toDay(max);
  const span   = maxDay - minDay || 1;

  const fromDay_ = from ? toDay(from) : minDay;
  const toDay_   = to   ? toDay(to)   : maxDay;

  const isFiltered = from || to;
  const trackRef   = useRef(null);
  const fromRef    = useRef(null);
  const toRef      = useRef(null);

  // Synchronously flip z-index on the DOM nodes before the browser decides
  // which input captures the drag — React setState is too late (async re-render).
  const handlePointerDown = useCallback(e => {
    const track = trackRef.current;
    const fromEl = fromRef.current;
    const toEl   = toRef.current;
    if (!track || !fromEl || !toEl) return;

    const { left, width } = track.getBoundingClientRect();
    const clickPct = (e.clientX - left) / width;

    const fromPct = (fromDay_ - minDay) / span;
    const toPct   = (toDay_   - minDay) / span;

    const nearFrom = Math.abs(clickPct - fromPct) <= Math.abs(clickPct - toPct);
    fromEl.style.zIndex = nearFrom ? '5' : '3';
    toEl.style.zIndex   = nearFrom ? '3' : '5';
  }, [fromDay_, toDay_, minDay, span]);

  const handleFrom = useCallback(e => {
    const v = Math.min(Number(e.target.value), toDay_ - 1);
    onChange(v === minDay ? '' : fromDay(v), to);
  }, [toDay_, minDay, to, onChange]);

  const handleTo = useCallback(e => {
    const v = Math.max(Number(e.target.value), fromDay_ + 1);
    onChange(from, v === maxDay ? '' : fromDay(v));
  }, [fromDay_, maxDay, from, onChange]);

  const leftPct  = ((fromDay_ - minDay) / span) * 100;
  const rightPct = ((toDay_   - minDay) / span) * 100;

  return (
    <div className="flex flex-col gap-3">
      {/* Date labels */}
      <div className="flex justify-between text-xs text-slate-300 font-medium">
        <span>{fmtLabel(from || min)}</span>
        <span>{fmtLabel(to   || max)}</span>
      </div>

      {/* Dual-thumb slider */}
      <div
        ref={trackRef}
        className="relative h-5 flex items-center"
        onPointerDown={handlePointerDown}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-slate-600" />

        {/* Active fill between thumbs */}
        <div
          className="absolute h-1 rounded-full bg-blue-500"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* From thumb — starts beneath To thumb */}
        <input
          ref={fromRef}
          type="range"
          min={minDay}
          max={maxDay}
          value={fromDay_}
          onChange={handleFrom}
          className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: 3 }}
        />

        {/* To thumb — starts on top */}
        <input
          ref={toRef}
          type="range"
          min={minDay}
          max={maxDay}
          value={toDay_}
          onChange={handleTo}
          className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ zIndex: 5 }}
        />
      </div>

      {/* Span label + reset */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Data spans {min} — {max}
        </p>
        {isFiltered && (
          <button
            onClick={() => onChange('', '')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
