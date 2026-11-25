#!/usr/bin/env node
'use strict';

/**
 * Copies the canonical UteamUP agent skills (agentskills.io format) from the backend repository
 * (UteamUP_Backend/Skills, also served over MCP) into each host plugin, so every host gets the same bytes.
 *
 *   node scripts/sync-skills.js            copy
 *   node scripts/sync-skills.js --check    exit 1 when a plugin copy differs from the source
 *
 * Source: UTEAMUP_SKILLS_SOURCE, or ../UteamUP_Backend/Skills next to this repository.
 * Read-only plugins (they connect to /mcp/read-only) receive only skills whose metadata says access: read.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.resolve(
  process.env.UTEAMUP_SKILLS_SOURCE || path.join(ROOT, '..', 'UteamUP_Backend', 'Skills'),
);

const TARGETS = [
  { dir: 'plugins/claude/skills', readOnly: false },
  { dir: 'plugins/minimax/skills', readOnly: true, manifest: 'plugins/minimax/.minimax-plugin/plugin.json' },
  { dir: 'plugins/uteamup-zcode/skills', readOnly: true },
];

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in skills: ${full}`);
    if (entry.isDirectory()) return listFiles(full, base);
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

function readSkills() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Skill source not found: ${SOURCE}`);
  return fs
    .readdirSync(SOURCE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(SOURCE, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const dir = path.join(SOURCE, name);
      const skillMd = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
      const frontmatter = skillMd.startsWith('---\n') ? skillMd.slice(4, skillMd.indexOf('\n---', 4)) : '';
      const access = (frontmatter.match(/^\s+access:\s*"?(read|write)"?\s*$/m) || [])[1];
      if (!access) throw new Error(`${name}/SKILL.md has no metadata access: read|write`);
      const files = Object.fromEntries(
        listFiles(dir).sort().map((file) => [file, fs.readFileSync(path.join(dir, file))]),
      );
      return { name, readOnly: access === 'read', files };
    });
}

function expectedFor(target, skills) {
  return skills.filter((skill) => !target.readOnly || skill.readOnly);
}

function check(skills) {
  const problems = [];
  for (const target of TARGETS) {
    const dir = path.join(ROOT, target.dir);
    const expected = expectedFor(target, skills);
    const present = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    const names = expected.map((skill) => skill.name);
    if (JSON.stringify(present) !== JSON.stringify(names))
      problems.push(`${target.dir}: has [${present}] but expected [${names}]`);
    for (const skill of expected) {
      for (const [file, content] of Object.entries(skill.files)) {
        const copy = path.join(dir, skill.name, file);
        if (!fs.existsSync(copy) || !fs.readFileSync(copy).equals(content))
          problems.push(`${target.dir}/${skill.name}/${file} differs from the source`);
      }
    }
  }
  return problems;
}

function sync(skills) {
  for (const target of TARGETS) {
    const dir = path.join(ROOT, target.dir);
    fs.rmSync(dir, { recursive: true, force: true });
    const expected = expectedFor(target, skills);
    for (const skill of expected) {
      for (const [file, content] of Object.entries(skill.files)) {
        const destination = path.join(dir, skill.name, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, content);
      }
    }
    if (target.manifest) {
      const manifestPath = path.join(ROOT, target.manifest);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.skills = expected.map((skill) => `skills/${skill.name}/SKILL.md`);
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    console.log(`${target.dir}: ${expected.map((skill) => skill.name).join(', ')}`);
  }
}

const skills = readSkills();
if (process.argv.includes('--check')) {
  const problems = check(skills);
  problems.forEach((problem) => console.error(problem));
  process.exit(problems.length ? 1 : 0);
} else {
  sync(skills);
}
