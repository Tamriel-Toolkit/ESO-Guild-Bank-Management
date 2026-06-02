---
name: "ESO Testing And Performance"
description: "Plan frontend tests, end-to-end coverage, and bundle-size/performance improvements"
argument-hint: "What testing or performance gap should be addressed?"
agent: "agent"
model: "GPT-5 (copilot)"
---
Create an implementation-ready plan for testing and performance hardening in ESO Guild Gold Ledger.

Use these files as anchors:
- [README](../README.md)
- [src/App.jsx](../src/App.jsx)
- [src/components/TutorialOverlay.jsx](../src/components/TutorialOverlay.jsx)
- [src/components/Graph.jsx](../src/components/Graph.jsx)
- [server/auth-sharing.test.js](../server/auth-sharing.test.js)

Cover:
- High-risk frontend flows that need tests
- End-to-end smoke coverage for core user journeys
- Performance and bundle-size concerns from charts, dialogs, and onboarding
- Practical validation commands and CI-friendly checks

Required output:
1. Highest-risk untested flows.
2. Recommended test layers and tooling.
3. Concrete test cases to add first.
4. Performance/bundle improvements that fit the current stack.
5. Acceptance criteria and verification.