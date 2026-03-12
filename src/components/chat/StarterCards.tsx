'use client';

import { cn } from '@/lib/utils';
import { StarterPrompt } from '@/types';

interface StarterCardsProps {
  prompts: StarterPrompt[];
  onSelect: (prompt: string) => void;
}

const categoryColors: Record<string, string> = {
  risk: 'border-loss/30 hover:border-loss/50',
  review: 'border-accent/30 hover:border-accent/50',
  strategy: 'border-profit/30 hover:border-profit/50',
  position: 'border-caution/30 hover:border-caution/50',
};

export function StarterCards({ prompts, onSelect }: StarterCardsProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-20 mb-4">◎</div>
          <h2 className="text-xl font-semibold text-foreground">AI Trading Coach</h2>
          <p className="text-sm text-muted">
            Ask anything about your portfolio, positions, risk, or strategy.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSelect(prompt.prompt)}
              className={cn(
                'glass-card p-4 text-left transition-all hover:scale-[1.02] border',
                categoryColors[prompt.category] || 'border-border/50 hover:border-accent/50'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{prompt.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{prompt.label}</p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">{prompt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
