function indexSources(sources, label) {
  if (!Array.isArray(sources)) {
    throw new TypeError(`${label} must be an array`);
  }

  const byId = new Map();
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError(`${label} entries must be objects`);
    }
    const id = String(source.id || '').trim();
    if (!id) throw new TypeError(`${label} source id is required`);
    if (byId.has(id)) throw new Error(`duplicate source id in ${label}: ${id}`);
    byId.set(id, { ...source, id });
  }
  return byId;
}

/**
 * Built-in definitions provide adapter defaults. Repository JSON entries override
 * matching definitions by id and append new operational sources.
 *
 * The merge is intentionally shallow: arrays and nested objects in an override
 * replace the built-in value as a whole.
 */
function mergeSourceDefinitions(builtInSources, configuredSources = []) {
  const builtIns = indexSources(builtInSources, 'built-in sources');
  const configured = indexSources(configuredSources, 'configured sources');
  const merged = [];

  for (const [id, source] of builtIns) {
    merged.push(configured.has(id) ? { ...source, ...configured.get(id), id } : source);
    configured.delete(id);
  }
  merged.push(...configured.values());

  for (const source of merged) {
    if (!String(source.kind || '').trim()) {
      throw new TypeError(`source kind is required: ${source.id}`);
    }
  }
  return merged;
}

module.exports = { mergeSourceDefinitions };
