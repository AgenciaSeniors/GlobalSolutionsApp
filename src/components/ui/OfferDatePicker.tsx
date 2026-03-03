'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

interface Props {
  /** Comma-separated YYYY-MM-DD string — same format the form already uses */
  value: string;
  onChange: (value: string) => void;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function OfferDatePicker({ value, onChange }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Parse the comma-separated string into a Set for O(1) lookup
  const selected = new Set(
    value.split(',').map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );

  function toggle(dateStr: string) {
    const next = new Set(selected);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    onChange([...next].sort().join(', '));
  }

  function remove(dateStr: string) {
    const next = new Set(selected);
    next.delete(dateStr);
    onChange([...next].sort().join(', '));
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  // Build the calendar grid (Monday-first)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  let startDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;            // convert to Mon-first

  const cells: (number | null)[] = [...Array(startDow).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null); // pad last row

  const todayStr = toYMD(today);
  const sortedSelected = [...selected].sort();

  return (
    <div className="space-y-3">
      {/* ── Calendar grid ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        {/* Month navigation */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-neutral-800">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {DAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-neutral-400">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selected.has(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggle(dateStr)}
                className={[
                  'rounded-lg py-1.5 text-xs font-medium transition select-none',
                  isSelected
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : isToday
                    ? 'border border-brand-300 text-brand-700 hover:bg-brand-50'
                    : 'text-neutral-700 hover:bg-neutral-100',
                ].join(' ')}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected date chips ── */}
      {sortedSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sortedSelected.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
            >
              {d}
              <button
                type="button"
                onClick={() => remove(d)}
                className="hover:text-brand-900 transition"
                aria-label={`Quitar ${d}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Manual textarea (power users) ── */}
      <div>
        <p className="mb-1 text-xs text-neutral-400">
          También puedes escribir las fechas directamente (YYYY-MM-DD separadas por coma)
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          rows={2}
          placeholder="2026-03-03, 2026-03-10, 2026-03-17"
        />
      </div>
    </div>
  );
}
