# Project Guidelines

## Product Context
- This repo is ESO Guild Gold Ledger, a React + Vite frontend with a Node + Express + SQLite backend for tracking guild bank gold flow.
- Ground all recommendations in the current shipped surface before proposing new work: secure auth, recovery email and password reset, guest mode, guild sharing, entry CRUD, statistics/charts, onboarding tutorial, audit logs, and backups.
- Prefer improvements that increase competitiveness, trust, collaboration, reporting quality, and operational reliability.

## Review Priorities
- Start reviews by identifying what is already implemented successfully, then isolate the highest-value gaps.
- For product and roadmap asks, organize output into: current strengths, product gaps, UX gaps, technical risks, and recommended next bets.
- For code reviews, findings come first and should prioritize regressions, incomplete flows, data integrity risks, permission issues, and missing validation.

## Architecture And Scope
- Stay consistent with the current stack unless there is strong repo-specific evidence for change: React, Material UI, Express, SQLite, and server-backed session auth.
- Do not suggest broad rewrites or generic SaaS patterns that ignore the current codebase.
- Use the real implementation surfaces as anchors: [README](./README.md), [src/App.jsx](./src/App.jsx), [src/components/Graph.jsx](./src/components/Graph.jsx), [src/components/PieBreakdownChart.jsx](./src/components/PieBreakdownChart.jsx), [src/components/TutorialOverlay.jsx](./src/components/TutorialOverlay.jsx), [src/components/GuildProfilesDrawer.jsx](./src/components/GuildProfilesDrawer.jsx), [server/index.js](./server/index.js), and [server/auth-sharing.test.js](./server/auth-sharing.test.js).

## Implementation Guidance
- When asked to generate implementation prompts or plans, include: scope, assumptions, impacted files or surfaces, success criteria, risks, and verification steps.
- Prioritize the roadmap areas already identified for this app: role-based permissions, search and filtering, export/reporting, recurring dues, member dashboards, audit log UI, onboarding polish, notifications/reminders, mobile optimization, reconciliation tools, frontend tests, end-to-end tests, and bundle-size reduction.
- Favor incremental changes that preserve current behavior and keep guest mode, shared-guild flows, and server persistence aligned.

## Validation
- Recommend concrete validation for each proposal: targeted tests, build checks, and realistic smoke checks for auth, guild switching, entry CRUD, statistics, and onboarding behavior.
- When reviewing, call out testing gaps explicitly instead of assuming a feature is safe because it compiles.