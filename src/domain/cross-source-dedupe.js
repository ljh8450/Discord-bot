const { canonicalizeUrl } = require('./opportunity');

function normalizedTitle(value) {
  return String(value || '').toLowerCase().replace(/\[[^\]]+\]/g, '')
    .replace(/20\d{2}년?/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}

function signature(item) {
  let day = '';
  if (item.closesAt && !Number.isNaN(new Date(item.closesAt).getTime())) {
    day = new Date(item.closesAt).toISOString().slice(0, 10);
  }
  return `${item.type}|${normalizedTitle(item.title)}|${day}`;
}

function dedupeAcrossSources(items) {
  const ranked = items.map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.attributes?.sourcePriority || 0)
      - (a.item.attributes?.sourcePriority || 0) || a.index - b.index);
  const urls = new Set(); const signatures = new Set(); const kept = [];
  for (const entry of ranked) {
    const { item } = entry;
    if (item.type === 'JOB' || item.type === 'CONTENT') { kept.push(entry); continue; }
    let url = '';
    try { url = canonicalizeUrl(item.url); } catch { /* validation handles it */ }
    const key = signature(item);
    if ((url && urls.has(url)) || (normalizedTitle(item.title) && signatures.has(key))) continue;
    if (url) urls.add(url);
    signatures.add(key);
    kept.push(entry);
  }
  return kept.sort((a, b) => a.index - b.index).map((entry) => entry.item);
}

module.exports = { dedupeAcrossSources, normalizedTitle };
