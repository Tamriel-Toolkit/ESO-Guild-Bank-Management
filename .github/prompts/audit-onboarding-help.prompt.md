---
name: "ESO Trust And Onboarding"
description: "Plan audit-log UI, onboarding improvements, and help/tutorial enhancements"
argument-hint: "What trust or onboarding feature should be planned?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create an implementation-ready plan for improving trust and onboarding features.

Ground the plan in:
- [src/App.jsx](../src/App.jsx)
- [src/components/TutorialOverlay.jsx](../src/components/TutorialOverlay.jsx)
- [src/components/GuildProfilesDrawer.jsx](../src/components/GuildProfilesDrawer.jsx)
- [server/index.js](../server/index.js)

Focus on:
- Audit log UI and activity history
- Better first-run education and contextual help
- Empty states and first-action guidance
- Help replay flows and discoverability

Required output:
1. Current behavior summary.
2. Proposed UX improvements.
3. Backend and frontend surfaces involved.
4. Risks and edge cases.
5. Acceptance criteria.
6. Verification plan.