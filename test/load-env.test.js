const assert = require('node:assert/strict');
const { mkdtemp, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadLocalEnv } = require('../src/config/load-env');

test('loads a local env file without overriding an existing environment variable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-env-'));
  const filePath = path.join(directory, '.env');
  await writeFile(filePath, 'RADAR_ENV_TEST=from-file\nRADAR_ENV_EXISTING=from-file\n', 'utf8');
  process.env.RADAR_ENV_EXISTING = 'from-process';

  try {
    assert.equal(loadLocalEnv(filePath), true);
    assert.equal(process.env.RADAR_ENV_TEST, 'from-file');
    assert.equal(process.env.RADAR_ENV_EXISTING, 'from-process');
  } finally {
    delete process.env.RADAR_ENV_TEST;
    delete process.env.RADAR_ENV_EXISTING;
  }
});

test('ignores a missing local env file', () => {
  assert.equal(loadLocalEnv(path.join(os.tmpdir(), 'missing-radar-env-file')), false);
});
