'use strict';

const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const wrapper = path.join(root, 'scripts/serial-run.mjs');
const core = path.join(root, 'scripts/serial-run-core.mjs');
const scripts = require('../package.json').scripts;

// Each child talks to its own fixture server, never the real Mac-wide queue
// already held by the outer Jest invocation.
function run(args, port, overrides = {}, entry = wrapper) {
  const env = { ...process.env };
  for (const key of ['CI', 'GITHUB_ACTIONS', 'PAPERCLIP_SERIAL_HELD']) delete env[key];
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: root,
    env: { ...env, PAPERCLIP_SERIAL_PORT: String(port), ...overrides },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const result = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  return { child, result };
}

const command = (label, delay = 0, code = 0) => [process.execPath, '-e',
  `console.log(${JSON.stringify(label)}, process.env.PAPERCLIP_SERIAL_HELD || 'direct'); ` +
  `setTimeout(() => process.exit(${code}), ${delay});`];

async function listen(onMessage) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    socket.on('data', data => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        onMessage(JSON.parse(line), socket);
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

const send = (socket, message) => socket.write(JSON.stringify(message) + '\n');
const grant = socket => send(socket, { granted: true, waitedSec: 1, limitSec: 1200 });

describe('repository serial-run client', () => {
  test('wraps every npm Jest entry point and lint', () => {
    for (const name of ['test', 'test:watch', 'test:integration', 'test:ai-governance', 'lint']) {
      expect(scripts[name]).toMatch(/^node scripts\/serial-run\.mjs -- (jest|eslint)\b/);
    }
  });

  test('holds both commands until their FIFO grant, then reports start and completion', async () => {
    const events = [];
    let queuedSocket, firstSocket;
    let firstAcquired;
    const acquired = new Promise(resolve => { firstAcquired = resolve; });
    const server = await listen((message, socket) => {
      events.push(message);
      if (message.op === 'acquire') {
        if (events.filter(event => event.op === 'acquire').length === 1) {
          firstSocket = socket;
          firstAcquired();
        } else {
          queuedSocket = socket;
          send(socket, { queued: true, ahead: 1 });
          grant(firstSocket);
        }
      } else if (message.op === 'done' && queuedSocket) {
        grant(queuedSocket);
        queuedSocket = null;
      }
    });
    try {
      const first = run(['--', ...command('first', 0, 7)], server.port);
      await acquired;
      const second = run(['--', ...command('second')], server.port);
      const results = await Promise.all([first.result, second.result]);
      expect(results[0]).toMatchObject({ code: 7, stdout: 'first 1\n' });
      expect(results[1]).toMatchObject({ code: 0, stdout: 'second 1\n' });
      expect(results[1].stderr).toContain('queued: 1 run(s) ahead');
      expect(results[1].stderr).toContain('slot acquired');
      expect(events.filter(event => event.op === 'started')).toHaveLength(2);
      expect(events.filter(event => event.op === 'done').map(event => event.code)).toEqual([7, 0]);
      const firstDone = events.findIndex(event => event.op === 'done');
      const secondStart = events.findLastIndex(event => event.op === 'started');
      expect(secondStart).toBeGreaterThan(firstDone);
      expect(events[0]).toMatchObject({ cwd: root, timeoutSec: 1200 });
    } finally {
      await server.close();
    }
  });

  test.each(['jest', 'eslint'])('queues %s when invoked from a bin shim', async tool => {
    const events = [];
    const server = await listen((message, socket) => {
      events.push(message);
      if (message.op === 'acquire') grant(socket);
    });
    try {
      const result = await run(['--shim', tool, '--eval', 'console.log("shim")'], server.port).result;
      expect(result).toMatchObject({ code: 0, stdout: 'shim\n' });
      expect(events[0].tool).toBe(tool);
      expect(events.at(-1)).toMatchObject({ op: 'done', code: 0 });
    } finally {
      await server.close();
    }
  });

  test('runs directly if the server is unavailable and preserves failure status', async () => {
    const server = await listen(() => {});
    const port = server.port;
    await server.close();
    const result = await run(command('fallback', 0, 9), port).result;
    expect(result).toMatchObject({ code: 9, stdout: 'fallback direct\n' });
    expect(result.stderr).toContain('queue server not reachable (ECONNREFUSED)');
  });

  test('reports a missing executable during fallback with exit 127', async () => {
    const server = await listen(() => {});
    const port = server.port;
    await server.close();
    const result = await run(['uteamup-nonexistent-serial-command'], port).result;
    expect(result.code).toBe(127);
    expect(result.stderr).toContain('failed to start');
    expect(result.stderr).not.toContain('Unhandled');
  });

  test('fails without executing when the queue closes before granting a slot', async () => {
    const server = await listen((_message, socket) => socket.end());
    try {
      const result = await run(command('must not run'), server.port).result;
      expect(result.code).toBe(75);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('run NOT executed');
    } finally {
      await server.close();
    }
  });

  test('runs directly on CI without contacting the queue', async () => {
    const messages = [];
    const server = await listen(message => messages.push(message));
    try {
      const result = await run(command('ci'), server.port, { CI: 'true' }).result;
      expect(result).toMatchObject({ code: 0, stdout: 'ci direct\n', stderr: '' });
      expect(messages).toEqual([]);
    } finally {
      await server.close();
    }
  });

  test.each(['--watch', '--watchAll', '--watch=true', '--watchAll=true'])(
    'rejects Jest %s before starting a process', async flag => {
      const result = await run(['jest', flag], 0).result;
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('watch mode is not allowed');
    }
  );

  test('documents usage when invoked with no command', async () => {
    const result = await run([], 0, {}, core).result;
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('usage: serial-run');
  });
});
