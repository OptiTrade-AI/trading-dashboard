'use client';

import { useState, useEffect } from 'react';
import { ALL_TICKERS } from '@/types';

interface TickerAutocompleteProps {
  value: string;
  onChange: (ticker: string) => void;
  label?: string;
  /** Tailwind classes for the icon background, e.g. "bg-accent/10" */
  iconBgClass?: string;
  /** Tailwind classes for the icon text, e.g. "text-accent" */
  iconTextClass?: string;
}

export function TickerAutocomplete({
  value,
  onChange,
  label = 'Ticker',
  iconBgClass = 'bg-accent/10',
  iconTextClass = 'text-accent',
}: TickerAutocompleteProps) {
  const [showTickerList, setShowTickerList] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState(ALL_TICKERS);

  useEffect(() => {
    if (value) {
      setFilteredTickers(
        ALL_TICKERS.filter(t => t.toLowerCase().includes(value.toLowerCase()))
      );
    } else {
      setFilteredTickers(ALL_TICKERS);
    }
  }, [value]);

  return (
    <div className="relative">
      <label className="stat-label mb-2 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowTickerList(true)}
        onBlur={() => setTimeout(() => setShowTickerList(false), 200)}
        className="input-field"
        placeholder="AAPL"
        required
      />
      {showTickerList && filteredTickers.length > 0 && (
        <div className="absolute top-full left-0 right-0 glass-card mt-2 overflow-hidden z-10 max-h-48 overflow-y-auto">
          {filteredTickers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t);
                setShowTickerList(false);
              }}
              className="w-full px-4 py-3 text-left text-foreground hover:bg-accent/10 transition-colors flex items-center gap-3"
            >
              <span className={`w-8 h-8 rounded-lg ${iconBgClass} flex items-center justify-center ${iconTextClass} text-xs font-bold`}>
                {t.slice(0, 2)}
              </span>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ALL_TICKERS };
