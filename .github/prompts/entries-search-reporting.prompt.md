---
name: "ESO Entries Search And Reporting"
description: "Plan search, filters, exports, and reporting improvements for the entry log and statistics"
argument-hint: "What reporting or entry-log feature should be planned?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create an implementation-ready plan for improving entry search, filtering, exports, and reporting.

Ground the plan in:
- [src/App.jsx](../src/App.jsx)
- [src/components/Graph.jsx](../src/components/Graph.jsx)
- [src/components/PieBreakdownChart.jsx](../src/components/PieBreakdownChart.jsx)
- [server/index.js](../server/index.js)

Consider features such as:
- Filters by date, user, type, notes, dues/donation, and withdrawal category
- Saved views or quick filters
- CSV export and summary exports
- Reporting views that reuse existing statistics logic

Required output:
1. Scope.
2. User-facing workflow.
3. Data/query implications.
4. Files and surfaces likely impacted.
5. Acceptance criteria.
6. Verification plan.