'use client';

import { useMemo } from 'react';
import { ResponsiveContainer, Treemap } from 'recharts';
import { StockHolding, StockPrice } from '@/types';
import { useFormatters } from '@/hooks/useFormatters';

function interpolateColor(changePercent: number): string {
  // Clamp to [-5, +5] range for color mapping
  const clamped = Math.max(-5, Math.min(5, changePercent));
  const t = (clamped + 5) / 10; // 0 = deep red, 0.5 = neutral, 1 = deep green

  // Red to neutral to green
  if (t < 0.5) {
    // Red (#ef4444) to dark neutral (#3f3f46)
    const ratio = t / 0.5;
    const r = Math.round(239 + (63 - 239) * ratio);
    const g = Math.round(68 + (63 - 68) * ratio);
    const b = Math.round(68 + (70 - 68) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Dark neutral (#3f3f46) to green (#10b981)
    const ratio = (t - 0.5) / 0.5;
    const r = Math.round(63 + (16 - 63) * ratio);
    const g = Math.round(63 + (185 - 63) * ratio);
    const b = Math.round(70 + (129 - 70) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

interface TreemapNode {
  name: string;
  value: number;
  changePercent: number;
  fill: string;
  [key: string]: string | number;
}

interface HoldingsTreemapProps {
  holdings: StockHolding[];
  priceMap: Map<string, StockPrice>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, name, changePercent } = props;
  if (width < 30 || height < 25) return null;

  const changePctStr = changePercent !== undefined
    ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`
    : '';

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={props.fill} fillOpacity={0.85} stroke="rgba(24,24,27,0.8)" strokeWidth={2} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fafafa" fontSize={width < 60 ? 10 : 13} fontWeight={600}>
        {name}
      </text>
      {height > 35 && (
        <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(250,250,250,0.7)" fontSize={10}>
          {changePctStr}
        </text>
      )}
    </g>
  );
}

export function HoldingsTreemap({ holdings, priceMap }: HoldingsTreemapProps) {
  const { privacyMode } = useFormatters();

  const data = useMemo(() => {
    const grouped = new Map<string, { marketValue: number; changePercent: number }>();

    for (const h of holdings) {
      const sp = priceMap.get(h.ticker);
      if (!sp) continue;
      const mv = h.shares * sp.price;
      const existing = grouped.get(h.ticker);
      if (existing) {
        existing.marketValue += mv;
      } else {
        grouped.set(h.ticker, { marketValue: mv, changePercent: sp.changePercent });
      }
    }

    const nodes: TreemapNode[] = [];
    for (const [ticker, { marketValue, changePercent }] of Array.from(grouped.entries())) {
      nodes.push({
        name: privacyMode ? ticker : ticker,
        value: marketValue,
        changePercent,
        fill: interpolateColor(changePercent),
      });
    }

    return nodes.sort((a, b) => b.value - a.value);
  }, [holdings, priceMap, privacyMode]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted">No price data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap
        data={data}
        dataKey="value"
        aspectRatio={4 / 3}
        content={<CustomContent />}
      />
    </ResponsiveContainer>
  );
}
