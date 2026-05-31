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

  const trackRef = useRef(null);

  // Keep latest values accessible inside pointer-move closures without stale state.
  const fromDayRef = useRef(fromDay_);
  const toDayRef   = useRef(toDay_);
  fromDayRef.current = fromDay_;
  toDayRef.current   = toDay_;

  const dayFromClientX = useCallback(clientX => {
    const { left, width } = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - left) / width));
    return Math.round(minDay + pct * span);
  }, [minDay, span]);

  const handleThumbDown = useCallback((thumb, e) => {
    e.preventDefault();
    e.stopPropagation();

    const onMove = ev => {
      const day = dayFromClientX(ev.clientX);
      if (thumb === 'from') {
        const v = Math.max(minDay, Math.min(day, toDayRef.current - 1));
        onChange(v === minDay ? '' : fromDay(v), to);
      } else {
        const v = Math.min(maxDay, Math.max(day, fromDayRef.current + 1));
        onChange(from, v === maxDay ? '' : fromDay(v));
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [minDay, maxDay, from, to, onChange, dayFromClientX]);

  const leftPct  = ((fromDay_ - minDay) / span) * 100;
  const rightPct = ((toDay_   - minDay) / span) * 100;

  return (
    <div className="flex flex-col gap-3">
      {/* Date labels */}
      <div className="flex justify-between text-xs text-slate-300 font-medium">
        <span>{fmtLabel(from || min)}</span>
        <span>{fmtLabel(to   || max)}</span>
      </div>

      {/* Track — no pointer events on the track itself */}
      <div ref={trackRef} className="relative h-5 flex items-center select-none">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-slate-600 pointer-events-none" />

        {/* Active fill */}
        <div
          className="absolute h-1 rounded-full bg-blue-500 pointer-events-none"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* From thumb */}
        <div
          onPointerDown={e => handleThumbDown('from', e)}
          className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-900 cursor-grab active:cursor-grabbing hover:bg-blue-400 transition-colors"
          style={{ left: `${leftPct}%`, transform: 'translateX(-50%)', zIndex: 2, touchAction: 'none' }}
        />

        {/* To thumb */}
        <div
          onPointerDown={e => handleThumbDown('to', e)}
          className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-900 cursor-grab active:cursor-grabbing hover:bg-blue-400 transition-colors"
          style={{ left: `${rightPct}%`, transform: 'translateX(-50%)', zIndex: 2, touchAction: 'none' }}
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
