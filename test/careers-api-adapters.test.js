const assert = require('node:assert/strict');
const test = require('node:test');

const { collectAll } = require('../src/adapters');
const { collectFromGreenhouseCareers } = require('../src/adapters/greenhouse-careers-adapter');
const { collectFromSaraminCareers, mapSaraminJob } = require('../src/adapters/saramin-careers-adapter');

test('maps the official Saramin JSON response to a job opportunity', () => {
  const item = mapSaraminJob({
    id: '123', active: 1, url: 'https://www.saramin.co.kr/jobs/123',
    company: { detail: { name: '예시테크' } },
    position: {
      title: '신입 백엔드 개발자',
      location: { name: '서울 > 강남구' },
      'job-type': { name: '정규직' },
      'job-mid-code': { name: 'IT개발·데이터' },
      'job-code': { name: '백엔드/서버개발' },
      'experience-level': { code: 1, min: 0, max: 0, name: '신입' },
      'required-education-level': { name: '학력무관' },
    },
    keyword: 'Java,SpringBoot,API',
    'posting-timestamp': '1784505600',
    'expiration-timestamp': '1787183999',
    'close-type': { code: '1', name: '접수마감일' },
  }, { id: 'saramin-entry-developers' });

  assert.equal(item.organization, '예시테크');
  assert.equal(item.status, 'OPEN');
  assert.equal(item.locations[0], '서울 > 강남구');
  assert.ok(item.eligibility.includes('신입'));
  assert.ok(item.tags.includes('백엔드/서버개발'));
  assert.equal(item.attributes.sourceTrust, 'AGGREGATOR_API');
});

test('calls Saramin with the configured key and IT developer category', async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url);
    return { ok: true, json: async () => ({ jobs: { job: [] } }) };
  };
  await collectFromSaraminCareers({
    id: 'saramin', url: 'https://oapi.saramin.co.kr/job-search', accessKeyEnv: 'TEST_KEY',
  }, fetchImpl, { TEST_KEY: 'secret-key' });

  assert.equal(requestedUrl.searchParams.get('access-key'), 'secret-key');
  assert.equal(requestedUrl.searchParams.get('job_mid_cd'), '2');
  assert.equal(requestedUrl.searchParams.get('count'), '100');
});

test('filters an official Greenhouse board to Korean entry-level developer jobs', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ jobs: [
      { id: 1, title: '신입 Backend Engineer', location: { name: 'Seoul, South Korea' }, absolute_url: 'https://jobs.example/1' },
      { id: 2, title: 'Senior Backend Engineer', location: { name: 'Seoul, South Korea' }, absolute_url: 'https://jobs.example/2' },
      { id: 3, title: 'Software Engineer Intern', location: { name: 'Seattle, USA' }, absolute_url: 'https://jobs.example/3' },
    ] }),
  });
  const items = await collectFromGreenhouseCareers({
    id: 'official', url: 'https://boards-api.greenhouse.io/v1/boards/example/jobs',
    organization: '예시', locationPattern: 'Korea|Seoul',
    roleTerms: ['backend', 'software'], entryLevelTerms: ['신입', 'intern'],
  }, fetchImpl);

  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, '1');
  assert.equal(items[0].attributes.sourceTrust, 'OFFICIAL_CAREERS');
});

test('skips a source cleanly until its required secret is configured', async () => {
  const result = await collectAll([
    { id: 'optional-api', kind: 'saramin-careers', enabled: true, requiredEnv: 'MISSING_KEY' },
  ], { env: {} });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.skippedSources, [{ sourceId: 'optional-api', reason: 'missing MISSING_KEY' }]);
  assert.equal(result.sourceCounts['optional-api'], 'SKIPPED');
});
