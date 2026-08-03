import { useTradeStore } from '../store/useTradeStore';
import { PlayerHeadshot } from './PlayerHeadshot';
import type { Player, Team } from '../types/trade';

interface TeamColumnProps {
    team: Team;
    allTeams: Team[];
    onTeamChange: (newTeamId: string) => void;
    excludeTeamId: string;
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
            <div className="player-identity">
                <PlayerHeadshot nbaId={player.nbaId} name={player.name} size="sm" />
                <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span className="player-position">{player.position}</span>
                </div>
            </div>
            <div className="player-stats">
                <span className="player-rating">OVR {player.rating}</span>
                <span className="player-salary">{formatSalary(player.salary)}</span>
            </div>
            <button className="stage-btn">{actionLabel}</button>
        </div>
    );
}

export function TeamColumn({ team, allTeams, onTeamChange, excludeTeamId }: TeamColumnProps) {
    const { stagePlayer, unstagePlayer, getOutgoing, getSalaryDelta } = useTradeStore();

    const outgoing = getOutgoing(team.id);
    const salaryDelta = getSalaryDelta(team.id);

    const availablePlayers = team.players.filter(
        (p) => !outgoing.some((o) => o.id === p.id)
    );

    return (
        <div className="team-column">
            <div className="team-header">
                <div style={{ width: '100%' }}>
                    {/* --- TEAM DROPDOWN --- */}
                    <select
                        value={team.id}
                        onChange={(e) => onTeamChange(e.target.value)}
                        className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-lg font-bold mb-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        style={{ width: '100%', marginBottom: '8px', padding: '8px', borderRadius: '6px' }}
                    >
                        {allTeams.map((t) => (
                            <option
                                key={t.id}
                                value={t.id}
                                disabled={t.id === excludeTeamId} // Prevents picking the opposing column's team
                            >
                                {t.name}
                            </option>
                        ))}
                    </select>

                    <div className="team-meta mt-1">
                        <span className="team-abbr">{team.abbreviation}</span>
                        <span className="team-conference">{team.conference}</span>
                        <span className="team-cap" style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
                            Cap: {formatSalary(team.salaryCap)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="team-roster">
                <h3>Roster</h3>
                <div className="player-list">
                    {availablePlayers.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            onClick={() => stagePlayer(team.id, player.id)}
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
                            onClick={() => unstagePlayer(team.id, player.id)}
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