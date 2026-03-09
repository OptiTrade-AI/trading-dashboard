export default function Strategy() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Strategy Reference</h1>
        <p className="text-muted mt-1">Your trading rules and guidelines</p>
      </div>

      {/* Quick Reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Max Heat</div>
          <div className="text-2xl font-bold text-caution">—</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Delta Range</div>
          <div className="text-2xl font-bold text-foreground">—</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Take Profit</div>
          <div className="text-2xl font-bold text-profit">—</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="stat-label mb-2">Max Loss</div>
          <div className="text-2xl font-bold text-loss">—</div>
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
            { rule: 'Define your max portfolio heat', desc: 'Set a maximum percentage of account value deployed as collateral' },
            { rule: 'Limit open positions', desc: 'Stay diversified, don\'t overconcentrate' },
            { rule: 'Stagger expirations', desc: 'Spread risk across different expiration dates' },
            { rule: 'Cap individual position size', desc: 'Limit any single position as a percentage of your account' },
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
            Customize your criteria
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Trend aligned with your timeframe',
            'Moving averages confirm direction',
            'Price at key support/resistance level',
            'Momentum indicators in range',
            'Implied volatility favorable',
            'Strike selection meets your criteria',
            'Delta within your target range',
            'Fundamentals support the thesis',
            'Risk/reward ratio acceptable',
            'No major catalysts before expiration',
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
              <span className="font-semibold text-profit">Profit Target</span>
            </div>
            <p className="text-muted text-sm ml-8">Define your profit target percentage and close when hit</p>
          </div>

          <div className="bg-caution/5 rounded-xl p-5 border border-caution/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-caution/20 flex items-center justify-center">
                <span className="text-caution text-sm">⏱</span>
              </div>
              <span className="font-semibold text-caution">Time-Based Review</span>
            </div>
            <p className="text-muted text-sm ml-8 mb-2">At your chosen time threshold, evaluate the position:</p>
            <ul className="text-sm text-muted space-y-1 ml-8">
              <li>• If profitable → consider closing</li>
              <li>• If losing but thesis intact → consider rolling</li>
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
              <li>• <strong className="text-foreground">Thesis invalidated</strong> → Close immediately</li>
              <li>• <strong className="text-foreground">Max loss threshold reached</strong> → Close</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Watchlist */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <span className="text-lg">👁</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Watchlist</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-background/30 rounded-xl p-4">
            <div className="stat-label mb-3">Tier 1 (Primary)</div>
            <div className="flex flex-wrap gap-2">
              <p className="text-muted text-sm">Add your primary tickers here</p>
            </div>
          </div>
          <div className="bg-background/30 rounded-xl p-4">
            <div className="stat-label mb-3">Tier 2 (Secondary)</div>
            <div className="flex flex-wrap gap-2">
              <p className="text-muted text-sm">Add your secondary tickers here</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
