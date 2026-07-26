const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildRuntimeConfig,
  validateProfile,
} = require('../src/config/runtime-config');

function profile() {
  return {
    timezone: 'Asia/Seoul',
    job: {},
    benefit: { approvalThreshold: 3 },
  };
}

test('builds separate radar and brief registries from one runtime config', () => {
  const runtime = buildRuntimeConfig({
    profile: profile(),
    sourceConfig: {
      sources: [
        { id: 'linkareer', enabled: false },
        { id: 'custom-jobs', kind: 'json', enabled: true, url: 'https://example.com/jobs' },
      ],
      briefSources: [
        { id: 'openai-news', enabled: false },
      ],
    },
  });

  assert.equal(
    runtime.radarSources.find((source) => source.id === 'linkareer').enabled,
    false,
  );
  assert.equal(
    runtime.radarSources.find((source) => source.id === 'custom-jobs').kind,
    'json',
  );
  assert.equal(
    runtime.briefSources.find((source) => source.id === 'openai-news').enabled,
    false,
  );
  assert.equal(
    runtime.briefSources.some((source) => source.id === 'custom-jobs'),
    false,
  );
});

test('allows source arrays to be omitted and uses built-in defaults', () => {
  const runtime = buildRuntimeConfig({ profile: profile(), sourceConfig: {} });

  assert.ok(runtime.radarSources.length > 0);
  assert.ok(runtime.briefSources.length > 0);
});

test('rejects a profile without the current required sections', () => {
  assert.throws(
    () => validateProfile({ timezone: 'Asia/Seoul', benefit: {} }),
    /profile.job must be an object/,
  );
  assert.throws(
    () => validateProfile({ timezone: '', job: {}, benefit: {} }),
    /profile.timezone is required/,
  );
});
