import { useTradeStore } from '../store/useTradeStore';
import type { Player, Team } from '../types/trade';

interface TeamColumnProps {
    team: Team;
}

function formatSalary(amount: number): string {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
}

function PlayerCard({
    player,
    onClick,
    actionLabel
}: {
    player: Player;
    onClick: () => void;
    actionLabel: string;
}) {
    return (
        <div className="player-card" onClick={onClick}>
            <div className="player-info">
                <span className="player-name">{player.name}</span>
                <span className="player-position">{player.position}</span>
            </div>
            <div className="player-stats">
                <span className="player-rating">OVR: {player.rating}</span>
                <span className="player-salary">{formatSalary(player.salary)}</span>
            </div>
            <button className="stage-btn">{actionLabel}</button>
        </div>
    );
}

export function TeamColumn({ team }: TeamColumnProps) {
    const { stagePlayer, unstagePlayer, getOutgoing, getSalaryDelta } = useTradeStore();

    const outgoing = getOutgoing(team.id);
    const salaryDelta = getSalaryDelta(team.id);

    const availablePlayers = team.players.filter(
        (p) => !outgoing.some((o) => o.id === p.id)
    );

    const handleStage = (playerId: string) => {
        stagePlayer(team.id, playerId);
    };

    const handleUnstage = (playerId: string) => {
        unstagePlayer(team.id, playerId);
    };

    return (
        <div className="team-column">
            <div className="team-header">
                <h2>{team.name}</h2>
                <span className="team-abbr">{team.abbreviation}</span>
                <span className="team-conference">{team.conference}</span>
            </div>

            <div className="team-roster">
                <h3>Roster</h3>
                <div className="player-list">
                    {availablePlayers.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            onClick={() => handleStage(player.id)}
                            actionLabel="Stage"
                        />
                    ))}
                    {availablePlayers.length === 0 && (
                        <p className="empty-message">No players available</p>
                    )}
                </div>
            </div>

            <div className="trade-basket">
                <h3>Trade Basket</h3>
                <div className="basket-list">
                    {outgoing.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            onClick={() => handleUnstage(player.id)}
                            actionLabel="Remove"
                        />
                    ))}
                    {outgoing.length === 0 && (
                        <p className="empty-message">Click players above to stage them for trade</p>
                    )}
                </div>
                <div className={`salary-delta ${salaryDelta > 0 ? 'negative' : salaryDelta < 0 ? 'positive' : ''}`}>
                    Salary Delta: {salaryDelta > 0 ? '+' : ''}{formatSalary(salaryDelta)}
                </div>
            </div>
        </div>
    );
}