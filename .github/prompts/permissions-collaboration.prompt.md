---
name: "ESO Permissions Plan"
description: "Generate an implementation plan for role-based permissions and stronger guild collaboration flows"
argument-hint: "What permissions or collaboration feature should be planned?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create an implementation-ready plan for improving permissions and collaboration in ESO Guild Gold Ledger.

Ground the plan in:
- [src/App.jsx](../src/App.jsx)
- [src/components/GuildProfilesDrawer.jsx](../src/components/GuildProfilesDrawer.jsx)
- [server/index.js](../server/index.js)
- [server/auth-sharing.test.js](../server/auth-sharing.test.js)

Focus on features such as:
- Owner / treasurer / officer / viewer roles
- Per-role capabilities for entries, invites, member management, and settings
- Safer shared-guild workflows

Required output:
1. Current behavior summary.
2. Proposed permission model.
3. Backend changes.
4. Frontend/UI changes.
5. Migration or backward-compatibility concerns.
6. Acceptance criteria.
7. Verification plan including tests.