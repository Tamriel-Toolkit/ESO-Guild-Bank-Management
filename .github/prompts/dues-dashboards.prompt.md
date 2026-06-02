---
name: "ESO Dues And Dashboards"
description: "Plan recurring dues tracking, member summaries, and dashboard features using the current ledger model"
argument-hint: "What dues or dashboard feature should be planned?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create an implementation-ready plan for recurring dues tracking and member dashboards.

Use the current repo as context:
- [src/App.jsx](../src/App.jsx)
- [src/components/Graph.jsx](../src/components/Graph.jsx)
- [src/components/PieBreakdownChart.jsx](../src/components/PieBreakdownChart.jsx)
- [server/index.js](../server/index.js)

Cover ideas such as:
- Recurring expected dues per member
- Paid / overdue / partial states
- Member contribution summaries
- Dues history and donation history dashboards

Required output:
1. Data model proposal.
2. UI changes.
3. Server/API changes.
4. Migration strategy if needed.
5. Acceptance criteria.
6. Verification and test plan.