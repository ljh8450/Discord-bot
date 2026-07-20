const { existsSync } = require('node:fs');
const path = require('node:path');

function loadLocalEnv(filePath = process.env.RADAR_ENV_FILE || '.env') {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) return false;

  const existing = { ...process.env };
  process.loadEnvFile(resolved);
  Object.assign(process.env, existing);
  return true;
}

module.exports = { loadLocalEnv };
