# 🏀 NBA Trade Architect

NBA Trade Architect is a modern, web-based NBA trade simulator designed to strictly enforce the rules of the 2026 NBA Collective Bargaining Agreement (CBA). Built with React and Zustand, it allows users to construct complex multi-team trades, validates them against real-world salary cap restrictions, and provides AI-powered scouting reports using Google's Gemini AI.

## ✨ Key Features

* **Multi-Team Trade Routing:** Stage players from various teams into a central trade basket and seamlessly route them to new destinations.
* **Strict CBA Compliance Engine:** Real-time validation prevents illegal trades based on the latest NBA salary cap and apron restrictions.
* **AI GM Analysis:** Consults an AI "Executive Committee" to generate a scouting report detailing the risks, benefits, and positional impact of the proposed trade for all involved teams.
* **Live Roster Management:** Executing a valid trade instantly updates franchise rosters and available salary pools.

## ⚖️ CBA Considerations & Salary Cap Rules

This simulator is built to mirror the highly restrictive nature of the modern NBA CBA. The application uses a standard Salary Cap of **$165,000,000** and a Second Apron of **$222,000,000**. 

Every trade is validated against the following conditions before it can be executed or analyzed:

1. **The 125% + $250k Rule:** If a team is currently operating over the standard Salary Cap, the incoming salary they receive in a trade cannot exceed 125% of their outgoing salary, plus a $250,000 buffer.
2. **Second Apron Salary Freeze:** If a team's total payroll exceeds the Second Apron threshold, they are strictly prohibited from taking on *any* additional salary in a trade (their salary delta must be zero or negative).
3. **Second Apron Aggregation Ban:** Teams operating above the Second Apron are not allowed to aggregate multiple player salaries to match an incoming player's salary. "Two-for-one" outgoing player packages are automatically flagged as invalid.

If a trade violates any of these rules, the simulator disables trade execution and displays a specific warning explaining exactly which team violated which rule.

## 🧠 How the AI Analysis Works

When a trade is successfully validated, users can request an "AI Analysis." This feature leverages the **Google Gemini 1.5 Flash** model via a Vercel Serverless Function to evaluate the trade's logic.

The app sends a highly structured payload to the AI, which includes:
* The players being traded (including their age, rating, position, salary, and contract length).
* The remaining roster of every involved team.
* The positional breakdown of the remaining rosters.

The AI acts as a senior NBA analyst and evaluates the trade based on:
* **Value Exchange:** Are the teams getting fair value based on player OVR ratings?
* **Positional Depth:** Does a team accidentally trade away their only Point Guard or Center?
* **Contract Risk:** Is a team absorbing a massive, long-term contract for an aging or declining player?
* **Team Fit:** Do the incoming players address actual roster needs?

The AI then returns a formatted JSON scouting report featuring an overarching verdict (Smart, Risky, Questionable, or Bad), an executive summary, specific risks and benefits, and a team-by-team breakdown.

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite
* **State Management:** Zustand (with Immer for immutable state updates)
* **Backend / API:** Vercel Serverless Functions (Node.js/Express for local development)
* **Artificial Intelligence:** Google Generative AI SDK (`@google/generative-ai`)
* **Styling:** Vanilla CSS with CSS Grid/Flexbox

## 🚀 Local Development Setup

1. **Clone the repository and install dependencies:**
   `npm install`

2. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your Google Gemini API key:
   `GEMINI_API_KEY=your_api_key_here`

3. **Start the Frontend (Vite):**
   `npm run dev`

4. **Start the Local Backend (Express proxy for AI):**
   Open a second terminal window and run:
   `node api/server.js`

*(Note: When deploying to Vercel, the `api/server.js` file is ignored, and the application automatically routes requests to the serverless function defined in `api/analyze.ts`.)*