'use strict';

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');

describe('MCP AI governance boundary', () => {
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
    const sourceFiles = [
      path.join(repositoryRoot, 'index.js'),
      ...fs.readdirSync(path.join(repositoryRoot, 'lib'))
        .filter(fileName => fileName.endsWith('.js'))
        .map(fileName => path.join(repositoryRoot, 'lib', fileName))
    ];
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
