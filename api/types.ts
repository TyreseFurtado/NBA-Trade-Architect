// Single source of truth for types shared between src/ and api/.

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Player {
    id: string;
    name: string;
    position: Position;
    age: number;
    salary: number;
    contractYearsRemaining: number;
    rating: number;
}

export interface Team {
    id: string;
    name: string;
    abbreviation: string;
    conference: 'East' | 'West';
    salaryCap: number;
    players: Player[];
}

// ---------- API payload ----------

export interface TeamTradePayload {
    name: string;
    abbreviation: string;
    sending: Player[];
    receiving: Player[];
    remainingRoster: Player[]; // players not involved in the trade
}

// ---------- API response ----------

export interface TradeVerdict {
    verdict: 'smart' | 'risky' | 'questionable' | 'bad';
    summary: string;
    teamBreakdown: Array<{
        teamName: string;
        assessment: string;
        positionImpact: string;
    }>;
    risks: string[];
    benefits: string[];
}
