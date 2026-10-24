#!/usr/bin/env node
/* Strict validator for a MiniMax Code local Plugin V1 package.
   Usage: node validate-minimax-plugin.js <plugin-root>
   Exits 0 when the package satisfies the documented contract. */

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const errors = [];
const notes = [];
const fail = (m) => errors.push(m);
const note = (m) => notes.push(m);

const LIMITS = {
  maxEntries: 2048,
  maxFiles: 1024,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxPathBytes: 512,
  maxSegmentBytes: 128,
  maxSegments: 16,
};
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const NAME_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const AGENT_NAME_RE = /^[a-z][a-z0-9_-]*$/;
const CATEGORIES = [
  'Office',
  'Studio',
  'Design & Sites',
  'Code',
  'Business',
  'Sales',
  'Productivity',
  'Science & Healthcare',
  'Education',
  'Other',
];
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/* ---------- 1. strict JSON parse with duplicate-key detection ---------- */
function strictParse(text, label) {
  if (text.charCodeAt(0) === 0xfeff) {
    fail(`${label}: has a UTF-8 BOM`);
  }
  const dupes = [];
  const walker = (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const k of Object.keys(value)) {
        const full = key ? `${key}.${k}` : k;
        if (seen.has(full)) dupes.push(full);
        seen.add(full);
        walker(full, value[k]);
      }
    }
  };
  const seen = new Set();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    fail(`${label}: invalid JSON — ${e.message}`);
    return null;
  }
  walker('', parsed);
  if (dupes.length)
    fail(`${label}: duplicate keys — ${[...new Set(dupes)].join(', ')}`);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`${label}: root must be a JSON object`);
    return null;
  }
  return parsed;
}

/* ---------- 2. walk the package: limits, symlinks, segment rules ---------- */
let entries = 0,
  fileCount = 0,
  totalBytes = 0;
const files = [];
(function walk(dir, rel) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    fail(`${rel || '.'}: cannot read — ${e.message}`);
    return;
  }
  for (const item of items) {
    entries++;
    const abs = path.join(dir, item.name);
    const relPath = rel ? `${rel}/${item.name}` : item.name;
    if (item.isSymbolicLink()) {
      fail(`${relPath}: symlink is not allowed in a plugin package`);
      continue;
    }
    const segBytes = Buffer.byteLength(item.name, 'utf8');
    if (segBytes > LIMITS.maxSegmentBytes)
      fail(`${relPath}: path segment exceeds ${LIMITS.maxSegmentBytes} bytes`);
    if (!SEGMENT_RE.test(item.name))
      fail(`${relPath}: path segment does not match ${SEGMENT_RE}`);
    if (item.name.endsWith('.'))
      fail(`${relPath}: path segment must not end with '.'`);
    if (
      ['CON', 'PRN', 'AUX', 'NUL'].includes(item.name.toUpperCase()) ||
      /^(COM|LPT)[1-9]$/i.test(item.name)
    )
      fail(`${relPath}: reserved Windows basename`);
    if (relPath.split('/').length > LIMITS.maxSegments)
      fail(`${relPath}: exceeds ${LIMITS.maxSegments} path segments`);
    if (Buffer.byteLength(relPath, 'utf8') > LIMITS.maxPathBytes)
      fail(`${relPath}: path exceeds ${LIMITS.maxPathBytes} bytes`);
    if (item.isDirectory()) {
      walk(abs, relPath);
      continue;
    }
    if (!item.isFile()) {
      fail(`${relPath}: not a regular file`);
      continue;
    }
    fileCount++;
    const size = fs.statSync(abs).size;
    totalBytes += size;
    files.push({ relPath, abs, size });
    if (size > LIMITS.maxFileBytes)
      fail(`${relPath}: file exceeds ${LIMITS.maxFileBytes} bytes`);
  }
})(root, '');

if (entries > LIMITS.maxEntries)
  fail(`package has ${entries} entries, limit ${LIMITS.maxEntries}`);
if (fileCount > LIMITS.maxFiles)
  fail(`package has ${fileCount} regular files, limit ${LIMITS.maxFiles}`);
if (totalBytes > LIMITS.maxTotalBytes)
  fail(`package totals ${totalBytes} bytes, limit ${LIMITS.maxTotalBytes}`);

/* case-insensitive collision check */
const lower = new Map();
for (const f of files) {
  const k = f.relPath.toLowerCase();
  if (lower.has(k) && lower.get(k) !== f.relPath)
    fail(`case-insensitive path collision: ${lower.get(k)} vs ${f.relPath}`);
  lower.set(k, f.relPath);
}

/* ---------- 3. manifest ---------- */
const manifestPath = path.join(root, '.minimax-plugin', 'plugin.json');
if (!fs.existsSync(manifestPath)) fail('missing .minimax-plugin/plugin.json');
let manifest = null;
if (fs.existsSync(manifestPath)) {
  manifest = strictParse(
    fs.readFileSync(manifestPath, 'utf8'),
    '.minimax-plugin/plugin.json',
  );
}
if (manifest) {
  const m = manifest;
  if (m.schemaVersion !== 1)
    fail(`schemaVersion must be 1, got ${JSON.stringify(m.schemaVersion)}`);
  if (!NAME_RE.test(m.name || ''))
    fail(`name must match ${NAME_RE}, got ${JSON.stringify(m.name)}`);
  if (!SEMVER_RE.test(m.version || ''))
    fail(`version must be SemVer, got ${JSON.stringify(m.version)}`);
  if (!m.description || typeof m.description !== 'string')
    fail('description must be a non-empty string');
  if (!m.author || typeof m.author !== 'string')
    fail('author must be a non-empty string');
  if (!CATEGORIES.includes(m.category))
    fail(
      `category must be one of ${CATEGORIES.join(', ')}, got ${JSON.stringify(m.category)}`,
    );
  if (!Array.isArray(m.exampleQueries) || !m.exampleQueries.length)
    fail('exampleQueries must be a non-empty array');
  else
    m.exampleQueries.forEach((q, i) => {
      if (typeof q !== 'string' || !q.trim())
        fail(`exampleQueries[${i}] must be non-whitespace text`);
    });
  if (!Array.isArray(m.apps)) fail('apps must be an array');
  else if (m.apps.length)
    fail('apps must be an empty array (local App capability is ignored)');
  for (const k of ['mcpServers', 'skills', 'agents', 'hooks']) {
    if (m[k] !== undefined && !Array.isArray(m[k]))
      fail(`${k} must be an array when present`);
  }

  /* directory name must match manifest name */
  if (path.basename(root) !== m.name)
    note(
      `package directory "${path.basename(root)}" differs from manifest name "${m.name}"`,
    );

  /* icon + darkIcon */
  const iconChecks = (field, required) => {
    if (m[field] === undefined) {
      if (required) fail(`${field} is required`);
      return;
    }
    const p = m[field];
    if (typeof p !== 'string' || !p) {
      fail(`${field} must be a non-empty string`);
      return;
    }
    if (p.startsWith('/') || p.includes('..') || p.includes('\\'))
      fail(`${field} must be a package-relative path, got "${p}"`);
    if (!/\.(png|jpe?g|webp)$/i.test(p))
      fail(`${field} must reference a PNG/JPEG/WebP file, got "${p}"`);
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) fail(`${field} references a missing file: ${p}`);
    else {
      const buf = fs.readFileSync(abs);
      const isPng = buf
        .slice(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
      const isWebp =
        buf.slice(0, 4).toString() === 'RIFF' &&
        buf.slice(8, 12).toString() === 'WEBP';
      const ok =
        (/\.png$/i.test(p) && isPng) ||
        (/\.jpe?g$/i.test(p) && isJpg) ||
        (/\.webp$/i.test(p) && isWebp);
      if (!ok) fail(`${field} bytes do not match the declared file type: ${p}`);
    }
  };
  iconChecks('icon', true);
  iconChecks('darkIcon', false);

  /* referenced capability files must exist and stay inside the package */
  const refExists = (p, label) => {
    if (typeof p !== 'string' || !p) {
      fail(`${label} must be a package-relative path`);
      return;
    }
    if (p.startsWith('/') || p.includes('..') || p.includes('\\'))
      fail(`${label} escapes the package root: ${p}`);
    if (!fs.existsSync(path.join(root, p)))
      fail(`${label} references a missing file: ${p}`);
  };

  /* MCP servers */
  let effective = 0;
  (m.mcpServers || []).forEach((p) => {
    refExists(p, 'mcpServers entry');
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) return;
    const doc = strictParse(fs.readFileSync(abs, 'utf8'), p);
    if (!doc) return;
    if (doc.schemaVersion !== 1) fail(`${p}: schemaVersion must be 1`);
    if (
      !doc.mcpServers ||
      typeof doc.mcpServers !== 'object' ||
      !Object.keys(doc.mcpServers).length
    ) {
      fail(`${p}: mcpServers must be a non-empty object`);
      return;
    }
    for (const [name, srv] of Object.entries(doc.mcpServers)) {
      if (!NAME_RE.test(name))
        fail(`${p}: server name "${name}" must match ${NAME_RE}`);
      const t = srv.type;
      if (!['stdio', 'streamable-http', 'sse'].includes(t))
        fail(`${p}: unsupported transport "${t}"`);
      if (t === 'stdio') {
        if (!srv.command) fail(`${p}/${name}: stdio requires "command"`);
        if (srv.command.includes('/') || srv.command.includes('\\'))
          fail(`${p}/${name}: command must be PATH-resolved without a slash`);
        if (srv.url)
          fail(`${p}/${name}: do not mix stdio "command" with remote "url"`);
      } else {
        if (!srv.url || !/^https?:\/\//.test(srv.url))
          fail(`${p}/${name}: remote transport requires an http(s) URL`);
        if (srv.command)
          fail(`${p}/${name}: do not mix remote "url" with local "command"`);
      }
      for (const forbidden of [
        'auth',
        'oauth',
        'http',
        'refresh',
        'authorization',
      ]) {
        if (forbidden in srv)
          fail(`${p}/${name}: unsupported field "${forbidden}"`);
      }
      if (
        srv.timeout !== undefined &&
        !(Number.isInteger(srv.timeout) && srv.timeout > 0)
      ) {
        fail(
          `${p}/${name}: timeout must be a positive integer of milliseconds`,
        );
      }
      if (srv.env && (typeof srv.env !== 'object' || Array.isArray(srv.env)))
        fail(`${p}/${name}: env must be an object`);
      effective++;
    }
  });

  /* Skills */
  (m.skills || []).forEach((p) => {
    refExists(p, 'skills entry');
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) return;
    const rel = path.relative(root, abs);
    const parts = rel.split(path.sep);
    if (
      parts.length !== 3 ||
      parts[0] !== 'skills' ||
      parts[2] !== 'SKILL.md'
    ) {
      fail(
        `skills entry "${p}" must have the form skills/<skill-name>/SKILL.md`,
      );
      return;
    }
    const dirName = parts[1];
    const text = fs.readFileSync(abs, 'utf8');
    if (!text.startsWith('---')) {
      fail(`${p}: missing YAML frontmatter`);
      return;
    }
    const fmEnd = text.indexOf('\n---', 3);
    if (fmEnd === -1) {
      fail(`${p}: unterminated YAML frontmatter`);
      return;
    }
    const fm = text.slice(3, fmEnd);
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(
      /^description:\s*([\s\S]+?)(?=\n[a-zA-Z_-]+:|$)/m,
    );
    if (!nameMatch) fail(`${p}: frontmatter is missing "name"`);
    else if (nameMatch[1].trim() !== dirName)
      fail(
        `${p}: frontmatter name "${nameMatch[1].trim()}" must equal directory "${dirName}"`,
      );
    if (!descMatch || !descMatch[1].trim())
      fail(`${p}: frontmatter description must be non-empty`);
    effective++;
  });

  /* Agents */
  (m.agents || []).forEach((p) => {
    refExists(p, 'agents entry');
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) return;
    if (!/^agents\/[a-z][a-z0-9_-]*\.md$/.test(p))
      fail(`agents entry "${p}" must match ^agents/[a-z][a-z0-9_-]*\\.md$`);
    const stem = path.basename(p, '.md');
    const text = fs.readFileSync(abs, 'utf8');
    const nm = text.match(/^name:\s*(.+)$/m);
    if (!nm || nm[1].trim() !== stem)
      fail(`${p}: frontmatter name must equal the file stem "${stem}"`);
    const delegation = `${m.name}:${stem}`;
    if (delegation.length > 64)
      fail(`${p}: delegation name "${delegation}" exceeds 64 characters`);
    effective++;
  });

  /* Hooks */
  (m.hooks || []).forEach((p) => {
    refExists(p, 'hooks entry');
    effective++;
  });

  if (!effective)
    fail('no effective MCP server, Skill, subagent or Hook capability');
}

/* ---------- 4. report ---------- */
console.log(`package : ${root}`);
console.log(`entries : ${entries} (limit ${LIMITS.maxEntries})`);
console.log(`files   : ${fileCount} (limit ${LIMITS.maxFiles})`);
console.log(`bytes   : ${totalBytes} (limit ${LIMITS.maxTotalBytes})`);
console.log('');
if (notes.length) {
  console.log('NOTES');
  notes.forEach((n) => console.log(`  - ${n}`));
  console.log('');
}
if (errors.length) {
  console.log(`FAIL (${errors.length})`);
  errors.forEach((e) => console.log(`  x ${e}`));
  process.exit(1);
}
console.log('PASS — package satisfies the MiniMax Plugin V1 contract');
