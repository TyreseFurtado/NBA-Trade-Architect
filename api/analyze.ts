import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Player, TeamTradePayload, TradeVerdict } from './types';

// ---------- Prompt builder ----------

const fmtSalary = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

function rosterPositionBreakdown(players: Player[]): string {
  if (players.length === 0) return 'Empty roster';
  const counts: Record<string, number> = {};
  for (const p of players) counts[p.position] = (counts[p.position] ?? 0) + 1;
  return Object.entries(counts)
    .map(([pos, n]) => `${n}× ${pos}`)
    .join(', ');
}

function describePlayer(p: Player): string {
  return `${p.name} (${p.position}, Age ${p.age}, ${fmtSalary(p.salary)}, ${p.contractYearsRemaining}yr remaining, OVR ${p.rating})`;
}

function describePlayers(players: Player[]): string {
  if (players.length === 0) return '  (none)';
  return players.map((p) => `  • ${describePlayer(p)}`).join('\n');
}

function buildPrompt(teams: TeamTradePayload[]): string {
  const [a, b] = teams;

  return `You are a senior NBA analyst with deep knowledge of player value, team construction, and the salary cap. Evaluate the following trade proposal objectively.

═══════════════════════════════
TRADE PROPOSAL
═══════════════════════════════
${a.name} (${a.abbreviation}) sends:
${describePlayers(a.sending)}

${b.name} (${b.abbreviation}) sends:
${describePlayers(b.sending)}

═══════════════════════════════
POST-TRADE ROSTER DEPTH
═══════════════════════════════
${a.name} remaining roster (players NOT in this trade):
${describePlayers(a.remainingRoster)}
Positional breakdown: ${rosterPositionBreakdown(a.remainingRoster)}

${b.name} remaining roster (players NOT in this trade):
${describePlayers(b.remainingRoster)}
Positional breakdown: ${rosterPositionBreakdown(b.remainingRoster)}

═══════════════════════════════
ANALYSIS INSTRUCTIONS
═══════════════════════════════
Evaluate the trade across these dimensions:

1. VALUE EXCHANGE — Are both teams getting fair value in terms of player ratings and production?
2. POSITIONAL DEPTH — Does either team lose their only player at a critical position (e.g., sole PG, sole C)?
3. AGE & TRAJECTORY — Are players trending upward or declining? Is a team trading youth for aging stars or vice versa?
4. CONTRACT RISK — Is either team absorbing a large, long-term salary for a player who is old, injury-prone, or declining in OVR?
5. TEAM FIT — Do incoming players address a real team need or create positional redundancy?
6. KNOWN PLAYER CONTEXT — Use your knowledge of these real NBA players' playstyles, injury histories, and reputations to inform the analysis.

═══════════════════════════════
REQUIRED OUTPUT FORMAT
═══════════════════════════════
Return ONLY a valid JSON object. No markdown, no explanation outside the JSON.

{
  "verdict": "smart" | "risky" | "questionable" | "bad",
  "summary": "<2-3 sentence overall assessment of the trade>",
  "teamBreakdown": [
    {
      "teamName": "${a.name}",
      "assessment": "<1-2 sentences on what this team gains and loses>",
      "positionImpact": "<1 sentence flagging any positional voids or improvements>"
    },
    {
      "teamName": "${b.name}",
      "assessment": "<1-2 sentences on what this team gains and loses>",
      "positionImpact": "<1 sentence flagging any positional voids or improvements>"
    }
  ],
  "risks": ["<specific risk>", "<specific risk>"],
  "benefits": ["<specific benefit>", "<specific benefit>"]
}

Verdict guide:
• "smart"       — both teams clearly improve or address a genuine need
• "risky"       — one team is making a high-upside gamble with real downside (age, injury, positional void)
• "questionable" — lopsided value, or the logic is unclear for at least one team
• "bad"         — at least one team is clearly worse off with no compelling justification`;
}

// ---------- Handler ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teams } = (req.body ?? {}) as { teams?: TeamTradePayload[] };

  if (!Array.isArray(teams) || teams.length < 2) {
    return res.status(400).json({ error: 'Request must include at least two teams.' });
  }

  for (const team of teams) {
    if (!team.sending?.length) {
      return res
        .status(400)
        .json({ error: `${team.name} must be sending at least one player.` });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[analyze] GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // gemini-1.5-pro for high-quality reasoning.
    // Swap to 'gemini-2.0-flash' for lower latency if needed.
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4, // low temp = consistent, analytical tone
      },
    });

    const prompt = buildPrompt(teams);
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json|```/g, "").trim();

    const verdict: TradeVerdict = JSON.parse(raw);
    return res.status(200).json(verdict);
  } catch (err) {
    console.error('[analyze] Error:', err);
    return res.status(502).json({
      error: 'AI analysis failed. Check server logs or try again.',
    });
  }
}
