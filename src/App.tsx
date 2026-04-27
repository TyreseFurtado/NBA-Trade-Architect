import { useTradeStore } from './store/useTradeStore';
import { TeamColumn } from './components/TeamColumn';
import './App.css';

function App() {
  const { teams, isTradeValid, executeTrade, clearBasket, resetTeams } = useTradeStore();
  
  const tradeValid = isTradeValid();

  return (
    <div className="app">
      <header className="app-header">
        <h1>NBA Trade Architect</h1>
        <p className="subtitle">Build your dream trade</p>
      </header>

      <main className="trade-board">
        {teams.map((team) => (
          <TeamColumn key={team.id} team={team} />
        ))}
      </main>

      <footer className="app-footer">
        <div className="trade-actions">
          <button 
            className="action-btn execute" 
            disabled={!tradeValid}
            onClick={executeTrade}
          >
            Execute Trade
          </button>
          <button 
            className="action-btn clear"
            onClick={clearBasket}
          >
            Clear Basket
          </button>
          <button 
            className="action-btn reset"
            onClick={resetTeams}
          >
            Reset Teams
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
