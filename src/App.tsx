import { useState } from 'react';
import { useTradeStore, useHasHydrated } from './store/useTradeStore';
import { TeamColumn } from './components/TeamColumn';
import './trade.css';

function App() {
  const hasHydrated = useHasHydrated();

  const teams = useTradeStore((s) => s.teams);
  const isTradeValidFn = useTradeStore((s) => s.isTradeValid);
  const executeTrade = useTradeStore((s) => s.executeTrade);
  const clearBasket = useTradeStore((s) => s.clearBasket);
  const resetTeams = useTradeStore((s) => s.resetTeams);
  const verdict = useTradeStore((s) => s.verdict);
  const loading = useTradeStore((s) => s.loading);
  const analysisError = useTradeStore((s) => s.analysisError);
  const fetchAI = useTradeStore((s) => s.fetchAIAnalysis);

  // Track the two active teams currently on the board
  const [teamAId, setTeamAId] = useState('lakers');
  const [teamBId, setTeamBId] = useState('celtics');

  if (!hasHydrated) {
    return <div className="loading-state">Loading Trade Architect...</div>;
  }

  const tradeStatus = isTradeValidFn();
  const verdictTone = verdict?.verdict ?? 'risky';

  // Get the actual team objects to pass down
  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="trade-title">NBA Trade Architect</h1>
        <p className="subtitle">2026 CBA Compliant Simulator</p>

        <div className="trade-actions">
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
            className="action-btn execute action-btn--analysis"
            disabled={!tradeStatus.isValid || loading}
            onClick={fetchAI}
          >
            {loading ? <span className="loading-dots">consulting GMs</span> : 'AI Analysis'}
          </button>
        </div>

        {!tradeStatus.isValid && tradeStatus.reason && (
          <div className="trade-warning">
            ⚠️ {tradeStatus.reason}
          </div>
        )}
      </header>

      {!loading && verdict && (
        <section className={`scouting-report ${verdictTone}`}>
          <div className="report-header">
            <div className="verdict-badge">{verdict.verdict.toUpperCase()}</div>
            <div>
              <h3>Executive Summary</h3>
              <p className="report-subtitle">A polished snapshot of the trade’s upside, risks, and fit.</p>
            </div>
          </div>

          <p className="report-text">{verdict.summary || 'No summary provided.'}</p>

          {verdict.teamBreakdown?.length > 0 && (
            <div className="team-breakdown-grid">
              {verdict.teamBreakdown.map((team) => (
                <article key={team.teamName} className="breakdown-card">
                  <h4>{team.teamName}</h4>
                  <p>{team.assessment}</p>
                  <div className="position-pill">{team.positionImpact}</div>
                </article>
              ))}
            </div>
          )}

          <div className="report-grid">
            <div className="report-column">
              <h4>🚨 Risks</h4>
              <ul>
                {(verdict.risks || ['No specific risks identified.']).map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
            <div className="report-column">
              <h4>✅ Benefits</h4>
              <ul>
                {(verdict.benefits || ['No specific benefits identified.']).map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {!loading && !verdict && analysisError && (
        <section className="analysis-fallback">
          <div className="fallback-icon">🧠</div>
          <div className="fallback-content">
            <h3>Analysis unavailable</h3>
            <p>{analysisError}</p>
            <p className="fallback-hint">The trade board is still live. Try again in a moment or check your Gemini API quota.</p>
          </div>
        </section>
      )}

      <main className="trade-board">
        {teamA && (
          <TeamColumn
            team={teamA}
            allTeams={teams}
            onTeamChange={setTeamAId}
            excludeTeamId={teamBId}
          />
        )}
        {teamB && (
          <TeamColumn
            team={teamB}
            allTeams={teams}
            onTeamChange={setTeamBId}
            excludeTeamId={teamAId}
          />
        )}
      </main>
    </div>
  );
}

export default App;