import { StarterPrompt } from '@/types';

interface StarterPromptInput {
  openPositions: { ticker: string; dte: number; strategy: string; unrealizedPL?: number; contracts: number; capitalAtRisk: number }[];
  heat: number;
  maxHeatPercent: number;
  pressurePositions: { ticker: string; severity: string; dte: number; label: string }[];
  holdings: { ticker: string; shares: number }[];
  coveredCallTickers: string[];
  recentClosedTrades: { pl: number; exitDate: string }[];
  tickerConcentration: Record<string, number>;
  accountValue: number;
}

export function generateStarterPrompts(input: StarterPromptInput): StarterPrompt[] {
  const prompts: StarterPrompt[] = [];

  // Expiring positions (within 7 DTE)
  const expiring = input.openPositions.filter(p => p.dte <= 7 && p.dte >= 0);
  if (expiring.length > 0) {
    const tickers = [...new Set(expiring.map(p => p.ticker))].join(', ');
    prompts.push({
      label: `${expiring.length} expiring soon`,
      description: `${tickers} — ${expiring.length} position${expiring.length > 1 ? 's' : ''} within 7 DTE`,
      prompt: `I have ${expiring.length} position${expiring.length > 1 ? 's' : ''} expiring within 7 days (${tickers}). Review each one and tell me whether to close, roll, or let expire.`,
      icon: '⏰',
      category: 'risk',
    });
  }

  // High heat
  if (input.heat > 25) {
    prompts.push({
      label: `Heat at ${input.heat.toFixed(0)}%`,
      description: `Account heat is ${input.heat.toFixed(0)}% of your ${input.maxHeatPercent}% limit`,
      prompt: `My account heat is at ${input.heat.toFixed(1)}% (limit ${input.maxHeatPercent}%). Analyze my risk exposure and tell me if I should reduce any positions.`,
      icon: '🔥',
      category: 'risk',
    });
  }

  // Critical/danger pressure positions
  const criticalPressure = input.pressurePositions.filter(p => p.severity === 'critical' || p.severity === 'danger');
  if (criticalPressure.length > 0) {
    const worst = criticalPressure[0];
    prompts.push({
      label: `${worst.ticker} under pressure`,
      description: `${worst.label} — ${worst.severity} level, ${worst.dte} DTE`,
      prompt: `My ${worst.ticker} position (${worst.label}) is under ${worst.severity} pressure with ${worst.dte} DTE. What should I do — close, roll, or hold?`,
      icon: '⚠️',
      category: 'position',
    });
  }

  // Ticker concentration
  const concentrated = Object.entries(input.tickerConcentration)
    .filter(([, count]) => count >= 3 || (count >= 2 && Object.keys(input.tickerConcentration).length <= 3))
    .sort((a, b) => b[1] - a[1]);
  if (concentrated.length > 0) {
    const [ticker, count] = concentrated[0];
    prompts.push({
      label: `${ticker} concentration`,
      description: `${count} open positions in ${ticker}`,
      prompt: `I have ${count} open positions in ${ticker}. Is my exposure too concentrated? Should I diversify?`,
      icon: '📊',
      category: 'risk',
    });
  }

  // Uncovered holdings
  const uncovered = input.holdings.filter(h => !input.coveredCallTickers.includes(h.ticker));
  if (uncovered.length > 0) {
    const tickers = uncovered.map(h => h.ticker).slice(0, 3).join(', ');
    prompts.push({
      label: `${uncovered.length} uncovered`,
      description: `${tickers} — holdings without covered calls`,
      prompt: `I have ${uncovered.length} stock holding${uncovered.length > 1 ? 's' : ''} without covered calls (${tickers}). Should I sell calls on any of them? What strikes and expirations would you suggest?`,
      icon: '📈',
      category: 'strategy',
    });
  }

  // Losing streak
  const sorted = [...input.recentClosedTrades].sort((a, b) => b.exitDate.localeCompare(a.exitDate));
  let streak = 0;
  for (const t of sorted) {
    if (t.pl <= 0) streak++;
    else break;
  }
  if (streak >= 3) {
    prompts.push({
      label: `${streak}-trade losing streak`,
      description: `Last ${streak} closed trades were losses`,
      prompt: `I've had ${streak} consecutive losing trades. Review my recent exit decisions and tell me what's going wrong.`,
      icon: '📉',
      category: 'review',
    });
  }

  // Big unrealized winner
  const winners = input.openPositions.filter(p => p.unrealizedPL != null && p.unrealizedPL > 0)
    .sort((a, b) => (b.unrealizedPL || 0) - (a.unrealizedPL || 0));
  if (winners.length > 0 && winners[0].unrealizedPL! > 50) {
    const w = winners[0];
    prompts.push({
      label: `${w.ticker} is winning`,
      description: `+$${w.unrealizedPL!.toFixed(0)} unrealized on ${w.ticker}`,
      prompt: `My ${w.ticker} position is up $${w.unrealizedPL!.toFixed(0)} unrealized. Should I take profits now or let it ride?`,
      icon: '💰',
      category: 'position',
    });
  }

  // Evergreen prompts (fill to at least 4 total)
  const evergreen: StarterPrompt[] = [
    {
      label: 'Daily briefing',
      description: 'Overview of your portfolio and what needs attention today',
      prompt: 'Give me a daily trading briefing. What positions need attention today? Any expirations, pressure alerts, or opportunities I should know about?',
      icon: '☀️',
      category: 'review',
    },
    {
      label: 'Biggest risk',
      description: 'Identify the highest-risk positions in your portfolio',
      prompt: "What's my single biggest risk right now? Consider Greeks exposure, position concentration, upcoming expirations, and capital utilization.",
      icon: '🎯',
      category: 'risk',
    },
    {
      label: 'Strategy review',
      description: 'How are your different strategies performing?',
      prompt: 'Review my overall strategy performance. Which strategies are working best? Where am I losing money? What should I do more or less of?',
      icon: '📋',
      category: 'review',
    },
    {
      label: 'Trade ideas',
      description: 'Suggestions based on your current portfolio and capital',
      prompt: 'Based on my current portfolio, available capital, and performance history, what trades should I consider this week? Be specific with tickers, strikes, and expirations.',
      icon: '💡',
      category: 'strategy',
    },
  ];

  // Add evergreen prompts until we have at least 4
  for (const eg of evergreen) {
    if (prompts.length >= 6) break;
    // Don't duplicate if we already have a similar contextual prompt
    if (!prompts.some(p => p.category === eg.category && p.label === eg.label)) {
      prompts.push(eg);
    }
  }

  return prompts.slice(0, 6);
}
