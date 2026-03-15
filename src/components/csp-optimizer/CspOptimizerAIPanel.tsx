'use client';

import { cn } from '@/lib/utils';
import type { CspOptimizerAIAnalysis, CspStrategyLane, CspStrategyPick } from '@/types';
import { DiscussChatLink } from '@/components/DiscussChatLink';
import type { CspOptimizerProgressData } from '@/hooks/useCspOptimizer';

interface CspOptimizerAIPanelProps {
  analyses: Map<string, CspOptimizerAIAnalysis>;
  loading: boolean;
  error: string | null;
  progress: string;
  progressData?: CspOptimizerProgressData | null;
  onWritePut: (ticker: string, pick: CspStrategyPick) => void;
  privacyMode: boolean;
}

// Safe number formatting — AI may return strings or undefined
function n(v: unknown, decimals = 2): string {
  const num = typeof v === 'number' ? v : Number(v);
  if (isNaN(num)) return '—';
  return num.toFixed(decimals);
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const colorClass = color === 'green' ? 'text-profit' : color === 'red' ? 'text-loss' : 'text-foreground';
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted/60 uppercase tracking-wider">{label}</div>
      <div className={cn('text-[13px] font-medium', colorClass)}>{value}</div>
    </div>
  );
}

const LANE_ICONS: Record<string, string> = {
  conservative: '🛡',
  balanced: '⚖️',
  aggressive: '⚡',
};

function CspStrategyLaneCard({
  lane,
  ticker,
  onWritePut,
  mask,
}: {
  lane: CspStrategyLane;
  ticker: string;
  onWritePut: (ticker: string, pick: CspStrategyPick) => void;
  mask: (v: string) => string;
}) {
  const p = lane.pick;
  const icon = LANE_ICONS[lane.mode] || '📊';

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      lane.viable ? 'border-zinc-700/40 bg-zinc-900/40' : 'border-zinc-800/30 bg-zinc-900/20',
    )}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-2.5', !lane.viable && 'opacity-50')}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{lane.label}</span>
        </div>
        {lane.recommended && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 font-medium uppercase tracking-wider">
            Recommended
          </span>
        )}
      </div>

      {!lane.viable && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted italic">No viable pick found for this strategy</p>
        </div>
      )}

      {lane.viable && p && (
        <div className="px-4 pb-3 space-y-3">
          {/* Strike + expiration */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-lg font-bold text-foreground">{mask(`$${n(p.strike)}`)}</span>
              <span className="text-xs text-muted ml-2">
                exp {p.expiration}
              </span>
            </div>
            <span className="text-xs text-muted font-mono">{p.symbol}</span>
          </div>

          {/* Reasoning */}
          <p className="text-xs text-zinc-400 leading-relaxed">{p.reasoning}</p>

          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-2 py-2 border-t border-b border-zinc-800/40">
            <MetricCell label="Premium" value={mask(`$${n(p.premium)}`)} />
            <MetricCell label="Collateral" value={mask(`$${Number(p.collateral || 0).toLocaleString()}`)} />
            <MetricCell label="ROR" value={`${n(p.returnOnRisk, 1)}%`} color="green" />
            <MetricCell label="Ann. ROR" value={`${n(p.annualizedROR, 0)}%`} color="green" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <MetricCell label="Delta" value={n(p.delta)} />
            <MetricCell label="PoP" value={`${n(p.probabilityOfProfit, 0)}%`} color={Number(p.probabilityOfProfit) >= 70 ? 'green' : undefined} />
            <MetricCell label="Break Even" value={mask(`$${n(p.breakEven)}`)} />
            <MetricCell label="Discount" value={`${n(p.discountFromCurrent, 1)}%`} color="green" />
          </div>

          {/* OI + Volume */}
          <div className="flex items-center gap-4 text-[10px] text-muted">
            <span>OI: {Number(p.openInterest || 0).toLocaleString()}</span>
            <span>Vol: {Number(p.volume || 0).toLocaleString()}</span>
            <span>IV: {n(p.iv, 0)}%</span>
          </div>

          {/* Write Put button */}
          <button
            onClick={() => onWritePut(ticker, p)}
            className="w-full py-2 rounded-lg text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            Write This Put
          </button>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({
  analysis,
  onWritePut,
  privacyMode,
}: {
  analysis: CspOptimizerAIAnalysis;
  onWritePut: (ticker: string, pick: CspStrategyPick) => void;
  privacyMode: boolean;
}) {
  const mask = (v: string) => privacyMode ? '•••' : v;

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-foreground">{analysis.ticker}</span>
          <span className="text-sm text-muted">{mask(`$${n(analysis.stockPrice)}`)}</span>
        </div>
        <DiscussChatLink
          context={`CSP Optimizer analysis for ${analysis.ticker}: ${analysis.whyThisTrade}`}
          sourceFeature="csp-optimizer"
        />
      </div>

      {/* Why This Trade */}
      <div className="rounded-lg bg-zinc-800/40 px-4 py-3">
        <div className="text-[10px] text-muted/60 uppercase tracking-wider mb-1">Why This Trade</div>
        <p className="text-sm text-zinc-300 leading-relaxed">{analysis.whyThisTrade}</p>
      </div>

      {/* Catalyst banner */}
      {analysis.catalysts && analysis.catalysts.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5">
          <div className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-1">Catalysts</div>
          <ul className="space-y-0.5">
            {analysis.catalysts.map((c, i) => (
              <li key={i} className="text-xs text-amber-200/80">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Strategy Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {analysis.strategies.map(lane => (
          <CspStrategyLaneCard
            key={lane.mode}
            lane={lane}
            ticker={analysis.ticker}
            onWritePut={onWritePut}
            mask={mask}
          />
        ))}
      </div>

      {/* Assignment Scenario */}
      {analysis.assignmentScenario && (
        <div className="rounded-lg bg-zinc-800/40 px-4 py-3 space-y-2">
          <div className="text-[10px] text-muted/60 uppercase tracking-wider">If Assigned</div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted">Effective Cost Basis: </span>
              <span className="text-foreground font-medium">{mask(`$${n(analysis.assignmentScenario.effectiveCostBasis)}`)}</span>
              <span className="text-profit ml-1">({n(analysis.assignmentScenario.currentDiscount, 1)}% below current)</span>
            </div>
            <div>
              <span className="text-muted">CC Opportunity: </span>
              <span className="text-zinc-300">{analysis.assignmentScenario.ccOpportunity}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400">{analysis.assignmentScenario.qualityAssessment}</p>
        </div>
      )}

      {/* Position Sizing */}
      {analysis.positionSizing && (
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-muted">Suggested: </span>
            <span className="text-foreground font-medium">{analysis.positionSizing.suggestedContracts} contracts</span>
          </div>
          <div>
            <span className="text-muted">Capital: </span>
            <span className="text-foreground">{mask(`$${Number(analysis.positionSizing.capitalRequired || 0).toLocaleString()}`)}</span>
          </div>
          <div>
            <span className="text-muted">Heat Impact: </span>
            <span className={cn(
              'font-medium',
              Number(analysis.positionSizing.portfolioHeatImpact) > 10 ? 'text-loss' : Number(analysis.positionSizing.portfolioHeatImpact) > 5 ? 'text-caution' : 'text-profit',
            )}>
              +{n(analysis.positionSizing.portfolioHeatImpact, 1)}%
            </span>
          </div>
          <div>
            <span className="text-muted">Max: </span>
            <span className="text-zinc-400">{analysis.positionSizing.maxContracts} contracts</span>
          </div>
        </div>
      )}

      {/* Context sections */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {analysis.ivContext && (
          <div>
            <span className="text-muted">IV Context: </span>
            <span className="text-zinc-400">{analysis.ivContext}</span>
          </div>
        )}
        {analysis.bollingerContext && (
          <div>
            <span className="text-muted">Bollinger: </span>
            <span className="text-zinc-400">{analysis.bollingerContext}</span>
          </div>
        )}
        {analysis.analystConsensus && (
          <div>
            <span className="text-muted">Analysts: </span>
            <span className="text-zinc-400">{analysis.analystConsensus}</span>
          </div>
        )}
        {analysis.sectorContext && (
          <div>
            <span className="text-muted">Sector: </span>
            <span className="text-zinc-400">{analysis.sectorContext}</span>
          </div>
        )}
      </div>

      {/* Key Risks */}
      {analysis.keyRisks && analysis.keyRisks.length > 0 && (
        <div>
          <div className="text-[10px] text-muted/60 uppercase tracking-wider mb-1">Key Risks</div>
          <ul className="space-y-0.5">
            {analysis.keyRisks.map((r, i) => (
              <li key={i} className="text-xs text-zinc-500 flex items-start gap-1.5">
                <span className="text-loss mt-0.5">!</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export type AIViewMode = 'cards' | 'compare';

export function CspOptimizerAIPanel({
  analyses,
  loading,
  error,
  progress,
  progressData,
  onWritePut,
  privacyMode,
  viewMode = 'cards',
  onViewModeChange,
}: CspOptimizerAIPanelProps & {
  viewMode?: AIViewMode;
  onViewModeChange?: (mode: AIViewMode) => void;
}) {
  if (!loading && analyses.size === 0 && !error) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">AI Analysis</h3>
        {analyses.size >= 2 && onViewModeChange && (
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('cards')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'cards' ? 'bg-zinc-700 text-foreground' : 'text-zinc-400 hover:text-zinc-300',
              )}
            >
              Cards
            </button>
            <button
              onClick={() => onViewModeChange('compare')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'compare' ? 'bg-zinc-700 text-foreground' : 'text-zinc-400 hover:text-zinc-300',
              )}
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-card p-4 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <div className="text-sm text-foreground">{progress || 'Analyzing...'}</div>
            {progressData?.elapsedMs && (
              <div className="text-[10px] text-muted mt-0.5">
                {(progressData.elapsedMs / 1000).toFixed(1)}s elapsed
                {progressData.totalInputTokens ? ` · ${((progressData.totalInputTokens + (progressData.totalOutputTokens || 0)) / 1000).toFixed(1)}k tokens` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-loss/30">
          <p className="text-sm text-loss">{error}</p>
        </div>
      )}

      {/* Analysis cards — hidden when in compare mode */}
      {viewMode !== 'compare' && Array.from(analyses.values()).map(analysis => (
        <AnalysisCard
          key={analysis.ticker}
          analysis={analysis}
          onWritePut={onWritePut}
          privacyMode={privacyMode}
        />
      ))}
    </div>
  );
}
