import type { TeamTradePayload, TradeVerdict } from '../types/trade';

// The only place in the frontend that knows the backend endpoint exists.
const ANALYZE_URL = '/api/analyze';

export async function analyzeTrade(
  teams: TeamTradePayload[],
): Promise<TradeVerdict> {
  const res = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teams }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }

  return res.json() as Promise<TradeVerdict>;
}
