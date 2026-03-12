import type { OptionsContract } from '@/types';

// In-memory cache with 5-min TTL
const chainCache = new Map<string, { data: OptionsContract[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function fetchOptionsChain(
  ticker: string,
  optionType: 'call' | 'put',
  minDTE: number = 7,
  maxDTE: number = 60,
): Promise<OptionsContract[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  const cacheKey = `${ticker}-${optionType}-${minDTE}-${maxDTE}`;
  const cached = chainCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const now = new Date();
    const minDate = new Date(now.getTime() + minDTE * 86400000).toISOString().slice(0, 10);
    const maxDate = new Date(now.getTime() + maxDTE * 86400000).toISOString().slice(0, 10);

    // Fetch contracts from Polygon reference API
    const encodedTicker = encodeURIComponent(ticker);
    const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${encodedTicker}&contract_type=${optionType}&expiration_date.gte=${minDate}&expiration_date.lte=${maxDate}&limit=100&apiKey=${apiKey}`;
    const contractsRes = await fetch(contractsUrl);
    if (!contractsRes.ok) return [];

    const contractsData = await contractsRes.json();
    const contracts = contractsData.results || [];

    if (contracts.length === 0) return [];

    // Get snapshot data for these contracts
    const snapshotUrl = `https://api.polygon.io/v3/snapshot/options/${encodedTicker}?expiration_date.gte=${minDate}&expiration_date.lte=${maxDate}&contract_type=${optionType}&limit=100&apiKey=${apiKey}`;
    const snapshotRes = await fetch(snapshotUrl);

    const snapshotMap = new Map<string, Record<string, unknown>>();
    if (snapshotRes.ok) {
      const snapshotData = await snapshotRes.json();
      for (const snap of snapshotData.results || []) {
        if (snap.details?.ticker) {
          snapshotMap.set(snap.details.ticker, snap);
        }
      }
    }

    const result: OptionsContract[] = contracts.map((c: Record<string, unknown>) => {
      const snap = snapshotMap.get(c.ticker as string);
      const greeks = (snap as Record<string, unknown>)?.greeks as Record<string, number> | undefined;
      const day = (snap as Record<string, unknown>)?.day as Record<string, number> | undefined;
      const lastQuote = (snap as Record<string, unknown>)?.last_quote as Record<string, number> | undefined;

      return {
        symbol: c.ticker as string,
        strike: c.strike_price as number,
        expiration: c.expiration_date as string,
        bid: lastQuote?.bid ?? 0,
        ask: lastQuote?.ask ?? 0,
        midpoint: lastQuote ? ((lastQuote.bid ?? 0) + (lastQuote.ask ?? 0)) / 2 : 0,
        delta: greeks?.delta ?? null,
        theta: greeks?.theta ?? null,
        iv: (snap as Record<string, unknown>)?.implied_volatility as number ?? null,
        openInterest: (snap as Record<string, unknown>)?.open_interest as number ?? 0,
        volume: day?.volume ?? 0,
      };
    });

    chainCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return [];
  }
}
