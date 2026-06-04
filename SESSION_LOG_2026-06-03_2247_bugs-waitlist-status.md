# Session Log — 2026-06-03 22:47

## Goal
Add MCP test coverage for the new Bugs & Features `WaitList` status transitions (New ↔ WaitList) via the generic-proxy UpdateStatus tool. No index.js/lib changes (generic proxy).

## Work Log
- Added Jest coverage for moving a report New → WaitList and WaitList → New through the UpdateStatus tool.
