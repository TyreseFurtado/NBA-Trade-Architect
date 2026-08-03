import type { TeamTradePayload, TradeVerdict } from '../types/trade';

// The only place in the frontend that knows the backend endpoint exists.

const API_BASE_URL = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || '');


export async function analyzeTrade(proposal: TradeVerdict): Promise<TeamTradePayload> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(proposal),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch trade analysis');
  }

  return response.json();

}
