const { readFile } = require('node:fs/promises');
const path = require('node:path');

async function collectFromFile(source, rootDir = process.cwd()) {
  const filePath = path.resolve(rootDir, source.path);
  const items = JSON.parse(await readFile(filePath, 'utf8'));
  if (!Array.isArray(items)) throw new TypeError(`${source.id}: file source must contain a JSON array`);
  return items.map((item) => ({ ...item, sourceId: item.sourceId || source.id }));
}

module.exports = { collectFromFile };
