import { NextResponse } from 'next/server';
import { aiCall } from '@/lib/ai';
import { gatherPortfolioData } from '@/lib/ai-data';
import type { SmartAlert } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ alerts: [], available: false });
  }

  const data = await gatherPortfolioData();

  if (data.openPositions.length === 0) {
    return NextResponse.json({ alerts: [], available: true });
  }

  const now = new Date().toISOString().slice(0, 10);
  const heat = data.accountValue > 0 ? (data.totalCapitalAtRisk / data.accountValue * 100) : 0;

  // Build compact position summary
  let positionsSummary = '';
  for (const p of data.openPositions) {
    positionsSummary += `\n${p.id}: ${p.strategy} ${p.ticker} ${p.label} | ${p.contracts} contracts | DTE ${p.dte} | Capital $${Number(p.capitalAtRisk || 0).toFixed(0)}`;
  }

  const systemPrompt = `You are a trading alert system. Analyze these open options positions and identify ONLY those that need immediate attention.

Today: ${now}. Account: $${data.accountValue.toLocaleString()}. Heat: ${heat.toFixed(1)}%.

Open positions:${positionsSummary}

Return ONLY a JSON array of alerts for positions that need action. Each alert:
{"positionId":"<id>","ticker":"<TICKER>","urgency":"info|warning|critical","action":"<short action>","reason":"<one sentence>"}

Alert triggers:
- DTE <= 2: critical (expiring soon)
- DTE <= 7: warning (approaching expiration)
- Heat > 30%: warning (portfolio overexposed)
- Multiple positions on same ticker: info (concentration risk)
- DTE < 14 for sold premium: info (consider closing if profitable)

If no positions need attention, return an empty array: []
Return ONLY valid JSON, no markdown, no explanation.`;

  const result = await aiCall({
    feature: 'smart-alerts',
    model: 'claude-haiku-4-5-20251001',
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Analyze my positions for alerts.' }],
    maxTokens: 512,
  });

  if (!result) {
    return NextResponse.json({ alerts: [], available: false });
  }

  try {
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = result.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const alerts: SmartAlert[] = JSON.parse(jsonStr);
    return NextResponse.json({ alerts, available: true });
  } catch {
    return NextResponse.json({ alerts: [], available: false });
  }
}
