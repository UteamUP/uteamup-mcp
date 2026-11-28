#!/usr/bin/env node
// paperclip-serial-run v1 — Mac-wide single-slot FIFO queue for MCP checks
// (Jest and ESLint). Uses the same localhost protocol as the frontend wrapper.
// Usage:  node serial-run.mjs <command> [args...]
//    or   (from a node_modules/.bin shim) node serial-run.mjs --shim <tool> <realScript> [args...]
// The lock lives in a localhost queue server (127.0.0.1:3197) run by launchd on
// Gísli's Mac. If no server is reachable (CI, other machines) the command runs directly.
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = Number(process.env.PAPERCLIP_SERIAL_PORT || 3197);
const tag = '[serial-run]';
const say = (m) => process.stderr.write(`${tag} ${m}\n`);

const argv = process.argv.slice(2);
if (argv[0] === '--') argv.shift();
let tool, cmd, args, viaShim = false;
if (argv[0] === '--shim') {
  viaShim = true;
  tool = argv[1];
  cmd = process.execPath;
  args = argv.slice(3);
  const real = argv[2];
  ({ args } = normalize(tool, args));
  args = [real, ...args];
} else {
  if (!argv.length) { say('usage: serial-run <command> [args...]'); process.exit(2); }
  cmd = argv[0];
  args = argv.slice(1);
  tool = path.basename(cmd);
  if (tool === 'node' && args[0]) tool = `node:${path.basename(args[0])}`;
  ({ args } = normalize(tool, args));
}

function hasAny(a, flags) { return a.some((x) => flags.includes(x)); }

function normalize(t, a) {
  if (t === 'jest' || t === 'node:jest.js') {
    if (a.some((arg) => /^--watch(?:All)?(?:=|$)/.test(arg))) {
      say('Jest watch mode is not allowed on this Mac. Run a single test invocation.');
      process.exit(2);
    }
  }
  return { args: a };
}

function needsLock(t, a) {
  if (process.env.PAPERCLIP_SERIAL_HELD === '1') return false; // nested inside a run that already holds the slot
  if (process.env.CI || process.env.GITHUB_ACTIONS) return false;
  if (hasAny(a, ['--version', '-v', '--help', '-h']) && a.length <= 2) return false;
  if (!viaShim) return true; // explicit wrapper call always queues
  if (t === 'jest' || t === 'eslint') return true;
  return false;
}

function holdLimitSec() {
  const sec = Number(process.env.PAPERCLIP_SERIAL_TIMEOUT_SEC || 0);
  if (sec > 0) return Math.min(sec, 3600);
  const env = Number(process.env.PAPERCLIP_SERIAL_TIMEOUT_MIN || 0);
  if (env > 0) return Math.min(env, 60) * 60;
  return 20 * 60;
}

const realArgs = viaShim ? args.slice(1) : args;
const lock = needsLock(tool, realArgs);

function runChild(held, onStart) {
  const env = { ...process.env };
  if (held) env.PAPERCLIP_SERIAL_HELD = '1';
  const child = spawn(cmd, args, { stdio: 'inherit', env, detached: held });
  const fwd = (sig) => () => {
    try { held ? process.kill(-child.pid, sig) : child.kill(sig); } catch {}
  };
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, fwd(s));
  if (onStart) child.once('spawn', () => onStart(child));
  return child;
}

if (!lock) {
  const child = runChild(false);
  child.on('error', (e) => { say(`failed to start ${cmd}: ${e.message}`); process.exit(127); });
  child.on('exit', (code, sig) => process.exit(code ?? (sig ? 128 + 1 : 1)));
} else {
  const sock = net.createConnection({ host: '127.0.0.1', port: PORT });
  let timedOut = false, granted = false, child = null, buf = '', lastPos = -1, finished = false;
  const limit = holdLimitSec();
  const pretty = `${tool} ${realArgs.join(' ')}`.slice(0, 200);

  sock.on('connect', () => {
    sock.write(JSON.stringify({
      op: 'acquire', pid: process.pid, cwd: process.cwd(), tool, cmd: pretty, timeoutSec: limit,
      agent: process.env.PAPERCLIP_AGENT_NAME || process.env.PAPERCLIP_AGENT_ID || null,
    }) + '\n');
  });
  sock.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.queued && !granted) {
        if (m.ahead !== lastPos) {
          lastPos = m.ahead;
          const h = m.holder ? ` — running now: ${m.holder.tool} in ${m.holder.cwd} (${m.holder.heldSec}s)` : '';
          say(`queued: ${m.ahead} run(s) ahead of "${pretty}"${h}. Waiting (only one heavy test/check run at a time on this Mac).`);
        }
      } else if (m.granted && !granted) {
        granted = true;
        if (m.waitedSec > 0) say(`slot acquired after ${m.waitedSec}s wait; limit ${Math.round(m.limitSec / 60)} min`);
        child = runChild(true, (c) => sock.write(JSON.stringify({ op: 'started', pgid: c.pid }) + '\n'));
        child.on('error', (e) => { say(`failed to start ${cmd}: ${e.message}`); finish(127); });
        child.on('exit', (code, sig) => finish(code ?? (sig ? 128 + 15 : 1)));
      } else if (m.timeout) {
        timedOut = true;
        say(`TIME LIMIT (${Math.round(m.limitSec / 60)} min) reached — run killed so the next one can start.`);
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} process.exit(124); }, 5000);
      }
    }
  });
  sock.on('error', (e) => {
    if (!granted && (e.code === 'ECONNREFUSED' || e.code === 'EPERM' || e.code === 'EACCES')) {
      fellBack = true;
      say(`queue server not reachable (${e.code}); running without the Mac-wide lock`);
      const c = runChild(false);
      c.on('error', (err) => { say(`failed to start ${cmd}: ${err.message}`); process.exit(127); });
      c.on('exit', (code, sig) => process.exit(code ?? (sig ? 128 + 15 : 1)));
    } else if (!granted) {
      say(`queue error: ${e.message}`); process.exit(75);
    }
  });
  let fellBack = false;
  sock.on('close', () => {
    // Queue server went away while we were still waiting: fail loudly instead of
    // exiting 0 without running anything. (After grant the child keeps running.)
    setTimeout(() => {
      if (!granted && !finished && !fellBack) { say('queue server closed the connection before our turn; run NOT executed (exit 75). Retry.'); process.exit(75); }
    }, 100);
  });
  function finish(code) {
    if (finished) return; finished = true;
    if (timedOut) code = 124;
    try { sock.write(JSON.stringify({ op: 'done', code }) + '\n'); } catch {}
    sock.end();
    setTimeout(() => process.exit(code), 50);
  }
}
