---
name: "ESO Competitive Analysis"
description: "Analyze how this app can become more competitive and convert that into concrete feature bets"
argument-hint: "What competitive angle should GPT analyze?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Analyze ESO Guild Gold Ledger from a competitive product perspective.

Base the analysis on the current repo, especially:
- [README](../README.md)
- [src/App.jsx](../src/App.jsx)
- [server/index.js](../server/index.js)

Required output:
1. What the app already does better than a basic guild ledger or spreadsheet.
2. Likely user expectations from competing tools or alternatives.
3. The biggest feature, trust, and workflow gaps.
4. The 5 highest-leverage competitive bets for the next iteration.
5. For each bet: why it matters, what current code surfaces it touches, how difficult it is, and how to validate it.

Keep the output repo-aware and practical. Avoid generic SaaS growth advice.