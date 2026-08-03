import type { Team } from '../types/trade';

export type TeamFilterValue = 'all' | 'east' | 'west';

interface TeamFilterSelectProps {
  value: TeamFilterValue;
  onChange: (value: TeamFilterValue) => void;
  teams: Team[];
}

export function TeamFilterSelect({ value, onChange, teams }: TeamFilterSelectProps) {
  const eastCount = teams.filter((team) => team.conference === 'East').length;
  const westCount = teams.filter((team) => team.conference === 'West').length;

  return (
    <div className="team-filter">
      <label htmlFor="team-filter-select" className="team-filter__label">
        Board View
      </label>
      <select
        id="team-filter-select"
        className="team-filter__select"
        value={value}
        onChange={(event) => onChange(event.target.value as TeamFilterValue)}
      >
        <option value="all">All Teams ({teams.length})</option>
        <option value="east">Eastern Conference ({eastCount})</option>
        <option value="west">Western Conference ({westCount})</option>
      </select>
    </div>
  );
}
