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

    // Fetch contracts from Polygon reference API — paginate to get all strikes
    const encodedTicker = encodeURIComponent(ticker);
    let contracts: Record<string, unknown>[] = [];
    let contractsNextUrl: string | null = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${encodedTicker}&contract_type=${optionType}&expiration_date.gte=${minDate}&expiration_date.lte=${maxDate}&limit=250&apiKey=${apiKey}`;

    while (contractsNextUrl) {
      const res: Response = await fetch(contractsNextUrl);
      if (!res.ok) break;
      const body: { results?: Record<string, unknown>[]; next_url?: string } = await res.json();
      contracts = contracts.concat(body.results || []);
      contractsNextUrl = body.next_url ? `${body.next_url}&apiKey=${apiKey}` : null;
      if (contracts.length >= 1000) break;
    }

    if (contracts.length === 0) {
      console.log(`[polygon] fetchOptionsChain: 0 contracts from reference API for ${ticker} (${minDate} to ${maxDate})`);
      return [];
    }
    console.log(`[polygon] fetchOptionsChain: ${contracts.length} contracts from reference API for ${ticker}`);

    // Get snapshot data — paginate to match all contracts
    const snapshotMap = new Map<string, Record<string, unknown>>();
    let snapshotNextUrl: string | null = `https://api.polygon.io/v3/snapshot/options/${encodedTicker}?expiration_date.gte=${minDate}&expiration_date.lte=${maxDate}&contract_type=${optionType}&limit=250&apiKey=${apiKey}`;

    while (snapshotNextUrl) {
      const sRes: Response = await fetch(snapshotNextUrl);
      if (!sRes.ok) {
        console.log(`[polygon] fetchOptionsChain: snapshot API failed for ${ticker} (${sRes.status})`);
        break;
      }
      const sBody: { results?: Record<string, unknown>[]; next_url?: string } = await sRes.json();
      for (const snap of (sBody.results || [])) {
        const details = snap.details as Record<string, unknown> | undefined;
        if (details?.ticker) {
          snapshotMap.set(details.ticker as string, snap);
        }
      }
      snapshotNextUrl = sBody.next_url ? `${sBody.next_url}&apiKey=${apiKey}` : null;
      if (snapshotMap.size >= 1000) break;
    }
    console.log(`[polygon] fetchOptionsChain: ${snapshotMap.size} snapshots for ${ticker}`);

    const result: OptionsContract[] = contracts.map((c: Record<string, unknown>) => {
      const snap = snapshotMap.get(c.ticker as string);
      const greeks = (snap as Record<string, unknown>)?.greeks as Record<string, number> | undefined;
      const day = (snap as Record<string, unknown>)?.day as Record<string, number> | undefined;
      const lastQuote = (snap as Record<string, unknown>)?.last_quote as Record<string, number> | undefined;
      const session = (snap as Record<string, unknown>)?.session as Record<string, number> | undefined;
      const prevDay = (snap as Record<string, unknown>)?.prev_day as Record<string, number> | undefined;

      // Use last_quote bid/ask if available, otherwise fall back to session/day/prevDay close
      let bid = lastQuote?.bid ?? 0;
      let ask = lastQuote?.ask ?? 0;
      let midpoint = (bid + ask) / 2;

      // Fallback: if no live bid/ask, use session close or day close or prev_day close
      if (midpoint <= 0) {
        const fallbackPrice = session?.close ?? day?.close ?? day?.c ?? prevDay?.close ?? prevDay?.c ?? 0;
        if (fallbackPrice > 0) {
          bid = fallbackPrice;
          ask = fallbackPrice;
          midpoint = fallbackPrice;
        }
      }

      return {
        symbol: c.ticker as string,
        strike: c.strike_price as number,
        expiration: c.expiration_date as string,
        bid,
        ask,
        midpoint,
        delta: greeks?.delta ?? null,
        theta: greeks?.theta ?? null,
        iv: (snap as Record<string, unknown>)?.implied_volatility as number ?? null,
        openInterest: (snap as Record<string, unknown>)?.open_interest as number ?? 0,
        volume: day?.volume ?? 0,
      };
    });

    const withPricing = result.filter(r => r.midpoint > 0).length;
    console.log(`[polygon] fetchOptionsChain: ${result.length} total contracts, ${withPricing} with pricing for ${ticker}`);

    chainCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return [];
  }
}
