'use client';

import { cn } from '@/lib/utils';

interface CspOptimizerSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  aiLoading: boolean;
  onSelectTopN: (n: number) => void;
  onAnalyze: () => void;
  onAnalyzeTopN: (n: number) => void;
  onClear: () => void;
}

const COST_PER_TICKER = 0.12;
const DEFAULT_ANALYZE_COUNT = 5;

export function CspOptimizerSelectionBar({
  selectedCount,
  totalCount,
  aiLoading,
  onSelectTopN,
  onAnalyze,
  onAnalyzeTopN,
  onClear,
}: CspOptimizerSelectionBarProps) {
  const analyzeCount = selectedCount > 0 ? selectedCount : Math.min(DEFAULT_ANALYZE_COUNT, totalCount);
  const estimatedCost = (analyzeCount * COST_PER_TICKER).toFixed(2);
  const hasResults = totalCount > 0;

  const handleAnalyze = () => {
    if (selectedCount > 0) {
      onAnalyze();
    } else {
      // Nothing selected — auto-select and analyze top N
      onAnalyzeTopN(DEFAULT_ANALYZE_COUNT);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Quick-select buttons */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted mr-1">Select top:</span>
        {[5, 10, 20].map(n => (
          <button
            key={n}
            onClick={() => onSelectTopN(n)}
            disabled={totalCount === 0}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {n}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selection info + actions */}
      <div className="flex items-center gap-3">
        {selectedCount > 0 && (
          <>
            <span className="text-xs text-muted">
              {selectedCount} selected
              <span className="text-zinc-600 ml-1">~${estimatedCost}</span>
            </span>
            <button
              onClick={onClear}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          </>
        )}
        <button
          onClick={handleAnalyze}
          disabled={!hasResults || aiLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            hasResults && !aiLoading
              ? 'bg-accent text-white hover:brightness-110'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
          )}
        >
          {aiLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {selectedCount > 0
                ? `AI Analyze (${selectedCount})`
                : `AI Analyze Top ${Math.min(DEFAULT_ANALYZE_COUNT, totalCount)}`
              }
            </>
          )}
        </button>
        {selectedCount === 0 && hasResults && !aiLoading && (
          <span className="text-[10px] text-zinc-600">~${estimatedCost}</span>
        )}
      </div>
    </div>
  );
}
