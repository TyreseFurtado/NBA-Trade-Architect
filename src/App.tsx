import { useTradeStore, useHasHydrated } from './store/useTradeStore';
import { TeamColumn } from './components/TeamColumn';
import './trade.css';

function App() {
  const hasHydrated = useHasHydrated();

  // Selectors
  const teams = useTradeStore((s) => s.teams);
  const basket = useTradeStore((s) => s.basket);
  const isTradeValidFn = useTradeStore((s) => s.isTradeValid); // Get the function reference
  const executeTrade = useTradeStore((s) => s.executeTrade);
  const clearBasket = useTradeStore((s) => s.clearBasket);
  const resetTeams = useTradeStore((s) => s.resetTeams);
  const verdict = useTradeStore((s) => s.verdict);
  const loading = useTradeStore((s) => s.loading);
  const fetchAI = useTradeStore((s) => s.fetchAIAnalysis);

  if (!hasHydrated) {
    return <div className="loading-state">Loading Trade Architect...</div>;
  }

  const tradeStatus = isTradeValidFn();

  return (
    <div className="app">
      <header className="app-header">
        <h1>NBA Trade Architect</h1>
        <p className="subtitle">2026 CBA Compliant Simulator</p>

        <div className="trade-actions" style={{ marginTop: '15px' }}>
          <button className="action-btn clear" onClick={clearBasket}>
            Clear Basket
          </button>
          <button className="action-btn reset" onClick={resetTeams}>
            Reset Rosters
          </button>
          <button
            className="action-btn execute"
            disabled={!tradeStatus.isValid}
            onClick={executeTrade}
          >
            Execute Trade
          </button>
          <button
            className="action-btn execute"
            style={{ background: 'var(--success)', color: 'black' }}
            disabled={!tradeStatus.isValid || loading}
            onClick={fetchAI}
          >
            {loading ? (
              <span className="loading-dots"> consulting GMs</span>
            ) : (
              'AI Analysis'
            )}
          </button>
        </div>

        {/* PRO TIP: Show the CBA violation reason so the user knows WHY it's invalid */}
        {!tradeStatus.isValid && tradeStatus.reason && (
          <div style={{ color: 'var(--accent)', marginTop: '10px', fontSize: '0.9rem', fontWeight: '600' }}>
            ⚠️ {tradeStatus.reason}
          </div>
        )}
      </header>

      {/* AI Verdict Display */}
      {verdict && !loading && (
        <section className={`scouting-report ${verdict.verdict || 'risky'}`}>
          <div className="report-header">
            {/* Use optional chaining to prevent crashes */}
            <div className="verdict-badge">{(verdict.verdict || 'Analysis').toUpperCase()}</div>
            <h3>Executive Summary</h3>
          </div>

          <p className="report-text">{verdict.summary || "No summary provided."}</p>

          <div className="report-grid">
            <div className="report-column">
              <h4>🚨 Risks</h4>
              <ul>
                {/* Always provide a fallback empty array */}
                {(verdict.risks || ["No specific risks identified."]).map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="report-column">
              <h4>✅ Benefits</h4>
              <ul>
                {(verdict.benefits || ["No specific benefits identified."]).map((b: string, i: number) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Changed class to trade-board to match your CSS grid definitions */}
      <main className="trade-board">
        {teams.map((team) => (
          <TeamColumn key={team.id} team={team} />
        ))}
      </main>
    </div>
  );
}

export default App;