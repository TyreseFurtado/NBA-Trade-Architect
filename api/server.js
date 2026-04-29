import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loads .env.local from the project root (one level above /api)
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const app = express();
app.use(cors());
app.use(express.json());

// --- Diagnostic log ---
const key = process.env.GEMINI_API_KEY;
console.log('--- System Check ---');
console.log('📂 Looking for .env.local at:', envPath);
if (!key) {
    console.log('❌ RESULT: GEMINI_API_KEY is NOT found in process.env');
} else {
    console.log('✅ RESULT: Key found! Starts with:', key.substring(0, 4) + '...');
}
console.log('--------------------');

// NOTE: This Express server is for LOCAL DEVELOPMENT only.
// On Vercel, api/analyze.ts is the live handler — this file is never run.
// Make sure vite.config.ts proxies /api to http://localhost:3000 so
// local requests reach this server instead of 404ing.

function buildPrompt(teams) {
    const tradeSection = teams
        .map((t) => `${t.name} sends: ${t.sending.map((p) => p.name).join(', ')}`)
        .join('\n');

    return `You are a senior NBA analyst. Evaluate this trade:
${tradeSection}
Return ONLY a JSON object with verdict, summary, teamBreakdown, risks, and benefits.`;
}

app.post('/api/analyze', async (req, res) => {
    try {
        const teams = req.body.teams || req.body.trade;
        if (!teams) return res.status(400).json({ error: 'Missing teams data' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({
            // FIX: 'gemini-flash-latest' is not a valid model string — throws a
            // 404 from the Gemini API. Must match a real identifier.
            model: 'gemini-1.5-flash-latest',
            generationConfig: { responseMimeType: 'application/json' },
        });

        const prompt = buildPrompt(teams);
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const cleaned = raw.replace(/```json|```/g, '').trim();

        res.json(JSON.parse(cleaned));
    } catch (err) {
        console.error('🔥 GM Office Error:', err.message);
        res.status(500).json({ error: 'The trade committee is deadlocked.' });
    }
});

app.listen(3000, () => console.log('🏀 GM Office open on port 3000'));