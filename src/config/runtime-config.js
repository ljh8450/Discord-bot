const { readFile } = require('node:fs/promises');
const path = require('node:path');

const {
  AGGREGATOR_SOURCES,
  BRIEF_SOURCES,
  OPPORTUNITY_SOURCES,
} = require('./builtin-sources');
const { mergeSourceDefinitions } = require('./source-registry');

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function validateProfile(profile) {
  assertObject(profile, 'profile');
  if (!String(profile.timezone || '').trim()) {
    throw new TypeError('profile.timezone is required');
  }
  assertObject(profile.job, 'profile.job');
  assertObject(profile.benefit, 'profile.benefit');
  return profile;
}

function buildRuntimeConfig({ profile, sourceConfig }) {
  validateProfile(profile);
  assertObject(sourceConfig, 'source config');

  const radarSources = mergeSourceDefinitions(
    [...AGGREGATOR_SOURCES, ...OPPORTUNITY_SOURCES],
    sourceConfig.sources || [],
  );
  const briefSources = mergeSourceDefinitions(
    BRIEF_SOURCES,
    sourceConfig.briefSources || [],
  );

  return {
    profile,
    radarSources,
    briefSources,
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function loadRuntimeConfig(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const env = options.env || process.env;
  const profilePath = path.resolve(rootDir, env.RADAR_PROFILE || 'config/profile.json');
  const sourcesPath = path.resolve(rootDir, env.RADAR_SOURCES || 'config/sources.json');
  const profile = options.profile || await readJson(profilePath);
  const sourceConfig = options.sourceConfig || await readJson(sourcesPath);

  return {
    ...buildRuntimeConfig({ profile, sourceConfig }),
    paths: { profile: profilePath, sources: sourcesPath },
  };
}

module.exports = {
  buildRuntimeConfig,
  loadRuntimeConfig,
  validateProfile,
};
