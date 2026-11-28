# MCP check commands

Read `../CLAUDE.md` and `MCPGuidelines.md` for the applicable project rules.

Use the repository queue client for heavy checks:

```sh
npm test -- --runInBand
npm run lint
node scripts/serial-run.mjs <command> [args...]
```

All npm Jest entry points and ESLint use this client. Never use a wrapper path
under `~/paperclip-ops/test-queue`; sandboxed agents cannot read that directory.
The bundled client requests the Mac-wide single FIFO slot over `127.0.0.1:3197`.
If the queue service is unavailable, it reports that fact and runs directly, as on CI.
Do not bypass an active queue, set `PAPERCLIP_SERIAL_HELD`, restart the queue
service, or launch a duplicate while waiting. Jest watch mode is rejected.

Complete implementation and test changes before running the final affected test
batch. Follow the current Paperclip testing policy: until 1 December 2026,
GitHub Actions is unavailable, so run the final checks locally through this wrapper
and record the actual output in the PR and task. Do not deploy from this task.
