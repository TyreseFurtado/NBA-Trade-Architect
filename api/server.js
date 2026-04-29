import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const app = express();
app.use(cors());
app.use(express.json());

// --- DIAGNOSTIC LOG ---
const key = process.env.GEMINI_API_KEY;
console.log("--- System Check ---");
console.log("📂 Looking for .env.local at:", envPath);
if (!key) {
    console.log("❌ RESULT: GEMINI_API_KEY is NOT found in process.env");
} else {
    console.log("✅ RESULT: Key found! Starts with:", key.substring(0, 4) + "...");
}
console.log("--------------------");

// --- Prompt Builder (Keep your existing one) ---
function buildPrompt(teams) {
    const [a, b] = teams;
    return `You are a senior NBA analyst. Evaluate this trade:
  ${a.name} sends: ${a.sending.map(p => p.name).join(', ')}
  ${b.name} sends: ${b.sending.map(p => p.name).join(', ')}
  Return ONLY a JSON object with verdict, summary, teamBreakdown, risks, and benefits.`;
}

app.post('/api/analyze', async (req, res) => {
    try {
        const teams = req.body.teams || req.body.trade;
        if (!teams) return res.status(400).json({ error: "Missing teams data" });

        // Use the validated key
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Use 'gemini-1.5-flash-latest' - it's the most reliable model string
        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = buildPrompt(teams);
        const result = await model.generateContent(prompt);
        res.json(JSON.parse(result.response.text()));

    } catch (err) {
        console.error('🔥 GM Office Error:', err.message);
        res.status(500).json({ error: 'The trade committee is deadlocked.' });
    }
});

app.listen(3000, () => console.log('🏀 GM Office open on port 3000'));