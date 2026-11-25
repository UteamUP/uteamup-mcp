'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOWED_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata'];
const PLUGINS = [
  { dir: 'plugins/claude/skills', readOnly: false },
  { dir: 'plugins/minimax/skills', readOnly: true },
  { dir: 'plugins/uteamup-zcode/skills', readOnly: true },
];

function skillsIn(dir) {
  const full = path.join(ROOT, dir);
  return fs
    .readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      skillMd: fs.readFileSync(path.join(full, entry.name, 'SKILL.md'), 'utf8'),
    }));
}

function frontmatterOf(skillMd) {
  expect(skillMd.startsWith('---\n')).toBe(true);
  return skillMd.slice(4, skillMd.indexOf('\n---', 4));
}

describe('portable agent skills shipped in host plugins', () => {
  test.each(PLUGINS)('$dir ships at least one skill', ({ dir }) => {
    expect(skillsIn(dir).length).toBeGreaterThan(0);
  });

  test.each(PLUGINS)('$dir skills follow the agentskills.io format only', ({ dir }) => {
    for (const { name, skillMd } of skillsIn(dir)) {
      const frontmatter = frontmatterOf(skillMd);
      const keys = [...frontmatter.matchAll(/^([A-Za-z][\w-]*):/gm)].map((match) => match[1]);
      expect(keys.filter((key) => !ALLOWED_KEYS.includes(key))).toEqual([]);
      expect(frontmatter.match(/^name:\s*(.+)$/m)[1].trim()).toBe(name);
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const description = frontmatter.match(/^description:\s*(.+)$/m)[1].trim();
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(1024);
    }
  });

  test.each(PLUGINS.filter((plugin) => plugin.readOnly))(
    '$dir only ships read skills because it connects to /mcp/read-only',
    ({ dir }) => {
      for (const { skillMd } of skillsIn(dir)) {
        expect(frontmatterOf(skillMd)).toMatch(/^\s+access:\s*"?read"?\s*$/m);
      }
    },
  );

  test('read-only plugins ship the same skill bytes as the full plugin', () => {
    const full = Object.fromEntries(skillsIn('plugins/claude/skills').map((s) => [s.name, s.skillMd]));
    for (const plugin of PLUGINS.filter((p) => p.readOnly)) {
      for (const { name, skillMd } of skillsIn(plugin.dir)) {
        expect(full[name]).toBe(skillMd);
      }
    }
  });

  test('the MiniMax manifest lists exactly the shipped skills', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'plugins/minimax/.minimax-plugin/plugin.json'), 'utf8'),
    );
    expect(manifest.skills).toEqual(
      skillsIn('plugins/minimax/skills').map((skill) => `skills/${skill.name}/SKILL.md`),
    );
  });
});
