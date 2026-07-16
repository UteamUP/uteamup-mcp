'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const javaScriptFilePattern = /\.(?:cjs|js|mjs)$/;

const collectJavaScriptFiles = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
    return entry.isFile() && javaScriptFilePattern.test(entry.name) ? [entryPath] : [];
  });

const sourceFiles = [
  path.join(repositoryRoot, 'index.js'),
  ...collectJavaScriptFiles(path.join(repositoryRoot, 'lib'))
].sort();

describe('MCP AI governance boundary', () => {
  test('discovers nested JavaScript implementation files recursively', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uteamup-mcp-governance-'));

    try {
      fs.mkdirSync(path.join(temporaryRoot, 'nested', 'deeper'), { recursive: true });
      fs.writeFileSync(path.join(temporaryRoot, 'root.js'), 'module.exports = {};');
      fs.writeFileSync(path.join(temporaryRoot, 'nested', 'module.mjs'), 'export {};');
      fs.writeFileSync(path.join(temporaryRoot, 'nested', 'deeper', 'module.cjs'), 'module.exports = {};');
      fs.writeFileSync(path.join(temporaryRoot, 'nested', 'ignored.json'), '{}');

      const discoveredFiles = collectJavaScriptFiles(temporaryRoot)
        .map(fileName => path.relative(temporaryRoot, fileName))
        .sort();

      expect(discoveredFiles).toEqual([
        path.join('nested', 'deeper', 'module.cjs'),
        path.join('nested', 'module.mjs'),
        'root.js'
      ]);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('contains no direct AI provider SDK dependency', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
    );
    const dependencyNames = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.optionalDependencies
    });

    for (const forbiddenDependency of [
      '@anthropic-ai/sdk',
      '@google/generative-ai',
      '@mistralai/mistralai',
      'openai'
    ]) {
      expect(dependencyNames).not.toContain(forbiddenDependency);
    }
  });

  test('contains no provider credential, endpoint, or control-plane marker', () => {
    const source = sourceFiles
      .map(fileName => fs.readFileSync(fileName, 'utf8'))
      .join('\n')
      .toLowerCase();

    for (const forbiddenMarker of [
      'anthropic_api_key',
      'api.anthropic.com',
      'api.mistral.ai',
      'api.openai.com',
      'api.x.ai',
      'aicontrolplanesnapshot',
      'aiproviderconfig',
      'gemini_api_key',
      'generativelanguage.googleapis.com',
      'google_api_key',
      'mistral_api_key',
      'openai_api_key',
      'xai_api_key'
    ]) {
      expect(source).not.toContain(forbiddenMarker);
    }
  });
});
