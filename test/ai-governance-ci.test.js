'use strict';

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');

const readRepositoryFile = relativePath =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const findNamedStep = (workflow, name) => {
  const lines = workflow.split('\n');
  const startIndex = lines.findIndex(line => line.trim() === `- name: ${name}`);
  if (startIndex < 0) return null;

  const indentation = lines[startIndex].search(/\S/);
  let endIndex = lines.length;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const lineIndentation = line.search(/\S/);
    if (lineIndentation < indentation
      || (lineIndentation === indentation && line.trim().startsWith('- '))) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join('\n');
};

describe('MCP AI governance CI contracts', () => {
  const packageJson = JSON.parse(readRepositoryFile('package.json'));
  const workflow = readRepositoryFile('.github/workflows/ci.yml');

  test('provides a focused governance command for both governance contracts', () => {
    const governanceCommand = packageJson.scripts['test:ai-governance'];

    expect(governanceCommand).toContain('ai-governance-boundary.test.js');
    expect(governanceCommand).toContain('ai-governance-ci.test.js');
    expect(governanceCommand).toContain('--runInBand');
  });

  test('lints the complete MCP implementation recursively', () => {
    expect(packageJson.scripts.lint).toMatch(/\beslint\b/);
    expect(packageJson.scripts.lint).toMatch(/(?:^|\s)index\.js(?:\s|$)/);
    expect(packageJson.scripts.lint).toMatch(/(?:^|\s)lib\/(?:\s|$)/);
    expect(packageJson.scripts.lint).toMatch(/(?:^|\s)test\/(?:\s|$)/);
  });

  test('keeps the transitive YAML parser above the patched security floor', () => {
    expect(packageJson.overrides).toMatchObject({
      'js-yaml@<3.15.0': '3.15.0'
    });
  });

  test('uses a tracked lockfile and reproducible CI install', () => {
    const ignoredPaths = readRepositoryFile('.gitignore')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    expect(fs.existsSync(path.join(repositoryRoot, 'package-lock.json'))).toBe(true);
    expect(ignoredPaths).not.toContain('package-lock.json');
    expect(workflow).toContain("node-version: '22'");
    expect(workflow).toMatch(/^\s+- run: npm ci$/m);
    expect(workflow).not.toMatch(/^\s+- run: npm install$/m);
  });

  test('runs the AI governance boundary as a blocking CI step', () => {
    const governanceStep = findNamedStep(workflow, 'AI governance boundary');

    expect(governanceStep).not.toBeNull();
    expect(governanceStep).toContain('npm run test:ai-governance');
    expect(governanceStep).not.toContain('continue-on-error: true');
  });

  test('keeps lint blocking in CI', () => {
    const lintStep = findNamedStep(workflow, 'Lint');

    expect(lintStep).not.toBeNull();
    expect(lintStep).toContain('npm run lint');
    expect(lintStep).not.toContain('continue-on-error: true');
  });
});
