---
name: "ESO Product Roadmap"
description: "Review the current app and generate a repo-aware roadmap with must-have, should-have, and later priorities"
argument-hint: "What should be reviewed or prioritized?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Review ESO Guild Gold Ledger and produce a roadmap grounded in the current implementation.

Use the current repo surface as your anchor:
- [README](../README.md)
- [src/App.jsx](../src/App.jsx)
- [src/components/Graph.jsx](../src/components/Graph.jsx)
- [src/components/PieBreakdownChart.jsx](../src/components/PieBreakdownChart.jsx)
- [src/components/TutorialOverlay.jsx](../src/components/TutorialOverlay.jsx)
- [src/components/GuildProfilesDrawer.jsx](../src/components/GuildProfilesDrawer.jsx)
- [server/index.js](../server/index.js)
- [server/auth-sharing.test.js](../server/auth-sharing.test.js)

Required output:
1. Current strengths already present in the app.
2. Product gaps that affect competitiveness.
3. UX gaps that affect adoption or clarity.
4. Technical risks or scaling concerns.
5. A roadmap grouped into `must-have`, `should-have`, and `later`.
6. For the top 5 roadmap items, include impacted areas/files, expected user value, implementation risk, and verification.

Constraints:
- Do not give generic startup advice.
- Do not recommend a stack rewrite unless the current architecture clearly blocks the feature.
- Prefer suggestions that work with the current React, MUI, Express, and SQLite setup.