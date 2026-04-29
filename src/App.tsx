import { useTradeStore } from './store/useTradeStore';
import { TeamColumn } from './components/TeamColumn';
import './trade.css';

function App() {
  const teams = useTradeStore((s) => s.teams);
  const isValid = useTradeStore((s) => s.isTradeValid());
  const executeTrade = useTradeStore((s) => s.executeTrade);
  const clearBasket = useTradeStore((s) => s.clearBasket);
  const resetTeams = useTradeStore((s) => s.resetTeams);

  return (
    <div className="trade-board">
      <header className="trade-header">
        <h1 className="trade-title">NBA Trade Architect</h1>
        <div className="trade-actions">
          <button className="btn btn--secondary" onClick={clearBasket}>
            Clear
          </button>
          <button className="btn btn--danger" onClick={resetTeams}>
            Reset
          </button>
          <button
            className="btn btn--primary"
            disabled={!isValid}
            onClick={executeTrade}
          >
            Execute Trade
          </button>
        </div>
      </header>

      <div className="columns">
        {teams.map((team) => (
          <TeamColumn key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}

export default App;
