const { createHash } = require('node:crypto');

const TYPES = Object.freeze({
  JOB: 'JOB',
  HACKATHON: 'HACKATHON',
  EDUCATION: 'EDUCATION',
});

const REVIEW_STATUS = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  VALIDATING: 'VALIDATING',
  APPROVED: 'APPROVED',
  PENDING_BENEFIT: 'PENDING_BENEFIT',
  REJECTED: 'REJECTED',
  SENT: 'SENT',
});

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|ref)$/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stringList(value) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map(cleanText)
    .filter(Boolean);
}

function normalizeOpportunity(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') throw new TypeError('opportunity must be an object');
  if (!Object.values(TYPES).includes(raw.type)) throw new TypeError(`unsupported opportunity type: ${raw.type}`);
  if (!raw.sourceId) throw new TypeError('sourceId is required');
  if (!raw.url) throw new TypeError('url is required');
  if (!cleanText(raw.title)) throw new TypeError('title is required');

  const canonicalUrl = canonicalizeUrl(raw.url);
  const title = cleanText(raw.title);
  const organization = cleanText(raw.organization);
  const stableIdentity = raw.externalId
    ? `${raw.sourceId}:${raw.externalId}`
    : [raw.type, organization.toLowerCase(), title.toLowerCase(), raw.closesAt || ''].join('|');
  const contentBasis = JSON.stringify({
    title,
    organization,
    status: raw.status || 'OPEN',
    closesAt: raw.closesAt || null,
    locations: stringList(raw.locations),
    eligibility: stringList(raw.eligibility),
    tags: stringList(raw.tags),
    summary: cleanText(raw.summary),
  });

  return {
    id: `opp_${hash(stableIdentity).slice(0, 20)}`,
    type: raw.type,
    sourceId: String(raw.sourceId),
    externalId: raw.externalId ? String(raw.externalId) : null,
    canonicalUrl,
    title,
    organization,
    status: raw.status || 'OPEN',
    publishedAt: raw.publishedAt || null,
    closesAt: raw.closesAt || null,
    locations: stringList(raw.locations),
    eligibility: stringList(raw.eligibility),
    tags: stringList(raw.tags),
    summary: cleanText(raw.summary),
    summaryEvidence: stringList(raw.summaryEvidence),
    attributes: raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
    contentHash: `sha256:${hash(contentBasis)}`,
    dedupeKey: `discovered:${hash(stableIdentity)}`,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
  };
}

module.exports = {
  REVIEW_STATUS,
  TYPES,
  canonicalizeUrl,
  normalizeOpportunity,
};
