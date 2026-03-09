export default function Strategy() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Strategy Reference</h1>
        <p className="text-muted mt-1">Your CSP trading rules and guidelines</p>
      </div>

      {/* Quick Reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Max Heat</div>
          <div className="text-2xl font-bold text-caution">30%</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Delta Range</div>
          <div className="text-2xl font-bold text-foreground">0.20-0.35</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Take Profit</div>
          <div className="text-2xl font-bold text-profit">50%</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Max Loss</div>
          <div className="text-2xl font-bold text-loss">2x Premium</div>
        </div>
      </div>

      {/* Capital Rules */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <span className="text-lg">💰</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Capital Rules</h2>
        </div>
        <div className="grid gap-3">
          {[
            { rule: 'Max 30% portfolio heat', desc: 'Never exceed 30% of account value in total collateral' },
            { rule: 'Max 3-5 positions open', desc: 'Stay diversified, don\'t overconcentrate' },
            { rule: 'Stagger expirations', desc: 'Spread risk across different expiration dates' },
            { rule: 'No single position > 10%', desc: 'Limit individual position size' },
          ].map((item, i) => (
            <div key={i} className="bg-background/30 rounded-xl p-4 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-sm">{i + 1}</span>
              </div>
              <div>
                <div className="font-medium text-foreground">{item.rule}</div>
                <div className="text-muted text-sm mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Entry Checklist */}
      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">✓</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Entry Checklist</h2>
          </div>
          <span className="px-3 py-1 bg-accent/10 text-accent text-sm font-medium rounded-lg">
            Need 7/10
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Monthly trend bullish (price > 200 SMA)',
            'Weekly MAs stacked bullish',
            'Price at or near support',
            'RSI not overbought (under 70)',
            'IV elevated (IV rank > 30%)',
            'Strike at or below 50 SMA',
            'Delta 0.20-0.35',
            'Company is profitable',
            'Analyst price target > current price',
            'No earnings within expiration',
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 bg-background/30 rounded-xl p-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent text-sm font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </div>
              <span className="text-foreground text-sm">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Exit Rules */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <span className="text-lg">🚪</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Exit Rules</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-profit/5 rounded-xl p-5 border border-profit/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-profit/20 flex items-center justify-center">
                <span className="text-profit text-sm">✓</span>
              </div>
              <span className="font-semibold text-profit">50% Profit Rule</span>
            </div>
            <p className="text-muted text-sm ml-8">50% profit any time → CLOSE immediately</p>
          </div>

          <div className="bg-caution/5 rounded-xl p-5 border border-caution/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-caution/20 flex items-center justify-center">
                <span className="text-caution text-sm">⏱</span>
              </div>
              <span className="font-semibold text-caution">Decision Point</span>
            </div>
            <p className="text-muted text-sm ml-8 mb-2">50% time remaining → Evaluate position</p>
            <ul className="text-sm text-muted space-y-1 ml-8">
              <li>• If profitable at decision point → CLOSE</li>
              <li>• If losing but support intact → ROLL</li>
            </ul>
          </div>

          <div className="bg-loss/5 rounded-xl p-5 border border-loss/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-loss/20 flex items-center justify-center">
                <span className="text-loss text-sm">⚠</span>
              </div>
              <span className="font-semibold text-loss">Hard Stops</span>
            </div>
            <ul className="text-sm text-muted space-y-1 ml-8">
              <li>• <strong className="text-foreground">Support broken</strong> (weekly close below) → CLOSE immediately, never roll</li>
              <li>• <strong className="text-foreground">Loss &gt; 2x premium</strong> → CLOSE</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Core Watchlist */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <span className="text-lg">👁</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Core Watchlist</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-background/30 rounded-xl p-4">
            <div className="stat-label mb-3">Tier 1 (Primary)</div>
            <div className="flex flex-wrap gap-2">
              {['HOOD', 'NBIS', 'SOFI'].map((ticker) => (
                <div
                  key={ticker}
                  className="px-4 py-2 bg-accent/10 text-accent rounded-xl font-semibold flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center text-xs">
                    {ticker.slice(0, 2)}
                  </div>
                  {ticker}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-background/30 rounded-xl p-4">
            <div className="stat-label mb-3">Tier 2 (Secondary)</div>
            <div className="flex flex-wrap gap-2">
              {['IREN', 'CRDO', 'MSTR'].map((ticker) => (
                <div
                  key={ticker}
                  className="px-4 py-2 bg-muted/10 text-foreground/80 rounded-xl font-semibold flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-lg bg-muted/20 flex items-center justify-center text-xs text-muted">
                    {ticker.slice(0, 2)}
                  </div>
                  {ticker}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
