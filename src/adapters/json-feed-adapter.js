function getPath(value, fieldPath) {
  return String(fieldPath).split('.').reduce((current, key) => current?.[key], value);
}

async function collectFromJsonFeed(source, fetchImpl = fetch) {
  const response = await fetchImpl(source.url, {
    headers: { accept: 'application/json', 'user-agent': 'developer-opportunity-radar/0.1' },
    signal: AbortSignal.timeout(source.timeoutMs || 15_000),
  });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const body = await response.json();
  const items = source.itemsPath ? getPath(body, source.itemsPath) : body;
  if (!Array.isArray(items)) throw new TypeError(`${source.id}: configured items are not an array`);
  if (typeof source.map !== 'object') throw new TypeError(`${source.id}: map configuration is required`);

  return items.map((item) => Object.fromEntries(
    Object.entries(source.map).map(([target, fieldPath]) => [target, getPath(item, fieldPath)]),
  )).map((item) => ({ ...item, sourceId: source.id, type: item.type || source.type }));
}

module.exports = { collectFromJsonFeed, getPath };
