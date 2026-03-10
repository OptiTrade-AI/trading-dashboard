'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTradeAnalysis } from '@/hooks/useTradeAnalysis';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { TradeAnalysis } from '@/types';

type TimeRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | 'ALL' | 'CUSTOM';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'ALL' },
  { value: 'CUSTOM', label: 'Custom' },
];

interface Section {
  id: string;
  title: string;
  content: string;
}

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  // Split on ### headers
  const parts = text.split(/^### /m);

  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) {
      // Header with no content yet (still streaming)
      const title = part.trim();
      sections.push({ id: slugify(title), title, content: '' });
    } else {
      const title = part.slice(0, newlineIdx).trim();
      const content = part.slice(newlineIdx + 1).trim();
      sections.push({ id: slugify(title), title, content });
    }
  }

  return sections;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderLines(content: string): React.ReactNode[] {
  const blocks = content.split('\n\n');
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    return (
      <div key={i} className="mb-3 last:mb-0">
        {lines.map((line, j) => {
          if (!line.trim()) return null;
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={j} className="text-sm text-muted leading-relaxed ml-1 mb-1">
                <span className="text-muted/40 mr-2">—</span>
                {renderInline(line.slice(2))}
              </div>
            );
          }
          return (
            <p key={j} className="text-sm text-muted leading-relaxed">
              {renderInline(line)}
            </p>
          );
        })}
      </div>
    );
  });
}

// Scorecard: parse strategy lines and verdict
function ScorecardCard({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  // Strategy lines contain "—" with stats, verdict is usually the last bold line
  const strategyLines: string[] = [];
  const otherLines: string[] = [];

  for (const line of lines) {
    // Strategy line pattern: **Name** — X trades...
    if (/^\*\*.*\*\*\s*[—–-]/.test(line)) {
      strategyLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  return (
    <div className="space-y-3">
      {strategyLines.length > 0 && (
        <div className="space-y-2">
          {strategyLines.map((line, i) => {
            const match = line.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
            if (!match) return <div key={i} className="text-sm text-muted">{renderInline(line)}</div>;
            const [, name, stats] = match;
            // Try to extract P/L value for color coding
            const plMatch = stats.match(/[+-]?\$[\d,]+/);
            const isNegative = plMatch && plMatch[0].startsWith('-');
            const isPositive = plMatch && (plMatch[0].startsWith('+') || (!plMatch[0].startsWith('-') && !plMatch[0].startsWith('$0')));
            return (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-card-solid/30 border border-border/50">
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className={cn(
                  'text-sm',
                  isNegative ? 'text-loss' : isPositive ? 'text-profit' : 'text-muted'
                )}>
                  {renderInline(stats)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {otherLines.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          {otherLines.map((line, i) => (
            <p key={i} className="text-sm text-foreground font-medium leading-relaxed">
              {renderInline(line)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Findings: each paragraph as a mini-card with accent border
function FindingsCard({ content }: { content: string }) {
  const findings = content.split('\n\n').filter(b => b.trim());
  const colors = [
    'border-accent',
    'border-profit',
    'border-caution',
    'border-loss',
    'border-accent',
  ];

  return (
    <div className="space-y-3">
      {findings.map((finding, i) => (
        <div
          key={i}
          className={cn(
            'pl-4 border-l-2 py-2',
            colors[i % colors.length]
          )}
        >
          {finding.split('\n').map((line, j) => (
            <p key={j} className="text-sm text-muted leading-relaxed">
              {renderInline(line)}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// Action items: numbered with icons
function ActionItemsCard({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const cleaned = line.replace(/^\d+\.\s*/, '');
        return (
          <div key={i} className="flex gap-3 items-start py-2 px-3 rounded-lg bg-card-solid/30 border border-border/50">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
              <span className="text-accent text-xs font-bold">{i + 1}</span>
            </div>
            <p className="text-sm text-muted leading-relaxed flex-1">
              {renderInline(cleaned)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const SECTION_CONFIG: Record<string, { icon: string; renderer: 'scorecard' | 'findings' | 'actions' | 'default' }> = {
  'scorecard': { icon: '◈', renderer: 'scorecard' },
  'top-findings': { icon: '◉', renderer: 'findings' },
  'action-items': { icon: '◎', renderer: 'actions' },
};

function SectionCard({ section, isStreaming }: { section: Section; isStreaming: boolean }) {
  const config = SECTION_CONFIG[section.id] || { icon: '◇', renderer: 'default' as const };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent opacity-60">{config.icon}</span>
        <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
        {isStreaming && !section.content && (
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse ml-1" />
        )}
      </div>
      {section.content && (
        <div>
          {config.renderer === 'scorecard' && <ScorecardCard content={section.content} />}
          {config.renderer === 'findings' && <FindingsCard content={section.content} />}
          {config.renderer === 'actions' && <ActionItemsCard content={section.content} />}
          {config.renderer === 'default' && renderLines(section.content)}
        </div>
      )}
      {isStreaming && section.content && (
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse mt-2" />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getPreview(content: string): string {
  // Extract first meaningful line (skip headers)
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const first = lines[0] || '';
  // Strip markdown bold
  const clean = first.replace(/\*\*/g, '');
  return clean.length > 60 ? clean.slice(0, 60) + '...' : clean;
}

function HistoryPanel({
  history,
  selectedAnalysis,
  onSelect,
  onDelete,
  onNewAnalysis,
  isAnalyzing,
  privacyMode,
}: {
  history: TradeAnalysis[];
  selectedAnalysis: TradeAnalysis | null;
  onSelect: (a: TradeAnalysis | null) => void;
  onDelete: (id: string) => void;
  onNewAnalysis: () => void;
  isAnalyzing: boolean;
  privacyMode: boolean;
}) {
  const [showHistory, setShowHistory] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
        >
          <span className="text-accent opacity-60">◈</span>
          Past Analyses ({history.length})
          <span className="text-muted text-xs">{showHistory ? '▾' : '▸'}</span>
        </button>
        {selectedAnalysis && (
          <button
            onClick={onNewAnalysis}
            disabled={isAnalyzing}
            className="text-xs text-accent hover:underline"
          >
            New Analysis
          </button>
        )}
      </div>

      {showHistory && (
        <div className={cn('space-y-1 max-h-64 overflow-y-auto', privacyMode && 'blur-md select-none')}>
          {history.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-150 group',
                selectedAnalysis?.id === item.id
                  ? 'bg-accent/10 border border-accent/30'
                  : 'hover:bg-card-solid/50 border border-transparent'
              )}
              onClick={() => onSelect(selectedAnalysis?.id === item.id ? null : item)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted">{formatDate(item.createdAt)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    {item.timeRange}
                  </span>
                </div>
                <p className="text-xs text-muted/70 truncate mt-0.5">{getPreview(item.content)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-loss transition-all p-1 text-xs"
                title="Delete analysis"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const {
    analysis, isAnalyzing, isAvailable, isCheckingAvailability, error,
    generateAnalysis, clearAnalysis,
    history, selectedAnalysis, selectAnalysis, deleteAnalysis,
  } = useTradeAnalysis();
  const { privacyMode } = usePrivacy();

  const sections = useMemo(() => parseSections(analysis), [analysis]);

  const handleAnalyze = () => {
    if (timeRange === 'CUSTOM') {
      generateAnalysis(timeRange, startDate, endDate);
    } else {
      generateAnalysis(timeRange);
    }
  };

  if (isCheckingAvailability) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Strategy Analyzer</h1>
        <p className="text-muted text-sm mt-1">AI-powered review of your trading patterns</p>
      </div>

      {/* Unavailable state */}
      {!isAvailable && (
        <div className="glass-card p-6 text-center">
          <p className="text-muted text-sm">
            AI analysis requires an <code className="text-accent">ANTHROPIC_API_KEY</code> environment variable.
          </p>
          <p className="text-muted text-xs mt-2">
            Add it to your <code>.env</code> file and restart the dev server.
          </p>
        </div>
      )}

      {/* Controls */}
      {isAvailable && (
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 p-1 bg-card-solid/50 rounded-xl border border-border">
              {TIME_RANGES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                    timeRange === value
                      ? 'text-accent bg-accent/10'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeRange === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-card-solid border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                />
                <span className="text-muted text-sm">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-card-solid border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                />
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (timeRange === 'CUSTOM' && (!startDate || !endDate))}
              className={cn(
                'btn-primary ml-auto',
                isAnalyzing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isAnalyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze'}
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {isAvailable && (
        <HistoryPanel
          history={history}
          selectedAnalysis={selectedAnalysis}
          onSelect={selectAnalysis}
          onDelete={deleteAnalysis}
          onNewAnalysis={clearAnalysis}
          isAnalyzing={isAnalyzing}
          privacyMode={privacyMode}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card p-4 border-loss/30">
          <p className="text-loss text-sm">{error}</p>
          <button onClick={handleAnalyze} className="text-accent text-sm mt-2 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Viewing saved analysis label */}
      {selectedAnalysis && !isAnalyzing && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50" />
          Viewing saved analysis from {formatDate(selectedAnalysis.createdAt)}
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
            {selectedAnalysis.timeRange}
          </span>
        </div>
      )}

      {/* Section cards */}
      {sections.length > 0 && (
        <div className={cn('space-y-4 relative', privacyMode && 'blur-md select-none')}>
          {sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              isStreaming={isAnalyzing && i === sections.length - 1}
            />
          ))}
          {privacyMode && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
              <span className="text-muted text-sm backdrop-blur-none">Hidden — disable privacy mode to view</span>
            </div>
          )}
        </div>
      )}

      {/* Streaming with no sections yet */}
      {isAnalyzing && sections.length === 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-accent text-xs font-medium">Analyzing trades...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isAvailable && !analysis && !isAnalyzing && !error && (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4 opacity-20">◎</div>
          <p className="text-muted text-sm">Select a time range and click Analyze to review your trades.</p>
        </div>
      )}
    </div>
  );
}
