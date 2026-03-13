import { NextRequest, NextResponse } from 'next/server';
import { aiCall, extractJSON } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import { getAccountSettingsCollection } from '@/lib/collections';
import type { SmartAlert } from '@/types';

export const dynamic = 'force-dynamic';

async function generateAlerts(greeksMap?: Record<string, { delta?: number; theta?: number; iv?: number }>) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { alerts: [], available: false };
  }

  const data = await gatherPortfolioData();

  if (data.openPositions.length === 0) {
    return { alerts: [], available: true };
  }

  // Read configurable thresholds from account settings
  const settingsCol = await getAccountSettingsCollection();
  const settings = await settingsCol.findOne({});
  const dteWarning = settings?.alertDTEWarning ?? 7;
  const dteCritical = settings?.alertDTECritical ?? 2;
  const heatThreshold = settings?.alertHeatThreshold ?? 30;

  const now = new Date().toISOString().slice(0, 10);
  const heat = data.accountValue > 0 ? (data.totalCapitalAtRisk / data.accountValue * 100) : 0;

  // Build compact position summary with optional Greeks
  let positionsSummary = '';
  for (const p of data.openPositions) {
    let line = `\n${p.id}: ${p.strategy} ${p.ticker} ${p.label} | ${p.contracts} contracts | DTE ${p.dte} | Capital $${Number(p.capitalAtRisk || 0).toFixed(0)}`;
    // Enrich with Greeks if available
    const posId = p.id as string;
    if (greeksMap && greeksMap[posId]) {
      const g = greeksMap[posId];
      const parts: string[] = [];
      if (g.delta != null) parts.push(`Delta ${g.delta.toFixed(3)}`);
      if (g.theta != null) parts.push(`Theta $${g.theta.toFixed(2)}/day`);
      if (g.iv != null) parts.push(`IV ${(g.iv * 100).toFixed(1)}%`);
      if (parts.length > 0) line += ` | ${parts.join(', ')}`;
    }
    positionsSummary += line;
  }

  const systemPrompt = `You are a trading alert system. Analyze these open options positions and identify ONLY those that need immediate attention.

Today: ${now}. Account: $${data.accountValue.toLocaleString()}. Heat: ${heat.toFixed(1)}%.

Open positions:${positionsSummary}

Return ONLY a JSON array of alerts for positions that need action. Each alert:
{"positionId":"<id>","ticker":"<TICKER>","urgency":"info|warning|critical","action":"<short action>","reason":"<one sentence>"}

Alert triggers:
- DTE <= ${dteCritical}: critical (expiring soon)
- DTE <= ${dteWarning}: warning (approaching expiration)
- Heat > ${heatThreshold}%: warning (portfolio overexposed)
- Multiple positions on same ticker: info (concentration risk)
- DTE < 14 for sold premium: info (consider closing if profitable)
- High IV (>50%) on position: info (elevated implied volatility)
- Delta > 0.4 on sold positions: warning (position moving against you)

If no positions need attention, return an empty array: []
Return ONLY valid JSON, no markdown, no explanation.`;

  const result = await aiCall({
    feature: 'smart-alerts',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Analyze my positions for alerts.' }],
    maxTokens: 1024,
  });

  if (!result) {
    return { alerts: [], available: false };
  }

  try {
    const alerts: SmartAlert[] = extractJSON(result.text);
    return { alerts, available: true };
  } catch {
    return { alerts: [], available: false };
  }
}

export async function GET() {
  const result = await generateAlerts();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const greeksMap = body.greeks as Record<string, { delta?: number; theta?: number; iv?: number }> | undefined;
  const result = await generateAlerts(greeksMap);
  return NextResponse.json(result);
}
