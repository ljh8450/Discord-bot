const { applyProfileFilter } = require('../domain/filter');
const { normalizedTitle } = require('../domain/cross-source-dedupe');
const {
  DELIVERY_STATUS,
  EVENT_TYPES,
  NOTIFICATION_TYPE_ORDER,
  OPPORTUNITY_STATUS,
  OPPORTUNITY_TYPES,
  REVIEW_STATUS,
} = require('../domain/contracts');
const { normalizeOpportunity } = require('../domain/opportunity');
const { assessBenefit, validateMinimum } = require('../domain/validation');
const { URL_VERDICTS } = require('../validation/url-verifier');

function normalizedOrganization(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function findPreviouslySentEquivalentJob(state, opportunity) {
  if (opportunity.type !== OPPORTUNITY_TYPES.JOB) return null;
  const organization = normalizedOrganization(opportunity.organization);
  const title = normalizedTitle(opportunity.title);
  if (!organization || !title) return null;

  return Object.values(state.opportunities).find((candidate) => {
    if (candidate.id === opportunity.id || candidate.type !== OPPORTUNITY_TYPES.JOB) return false;
    if (candidate.sourceId === opportunity.sourceId) return false;
    const sent = candidate.review?.status === REVIEW_STATUS.SENT
      || state.deliveries[candidate.dedupeKey]?.status === DELIVERY_STATUS.SENT;
    if (!sent || candidate.status !== OPPORTUNITY_STATUS.OPEN) return false;
    return normalizedOrganization(candidate.organization) === organization
      && normalizedTitle(candidate.title) === title;
  }) || null;
}

function balanceByType(items, typeOrder = NOTIFICATION_TYPE_ORDER) {
  const queues = new Map(typeOrder.map((type) => [type, []]));
  for (const item of items) {
    if (!queues.has(item.type)) queues.set(item.type, []);
    queues.get(item.type).push(item);
  }
  const ordered = [];
  while ([...queues.values()].some((queue) => queue.length)) {
    for (const queue of queues.values()) {
      if (queue.length) ordered.push(queue.shift());
    }
  }
  return ordered;
}

async function runRadar(options) {
  const {
    rawItems,
    profile,
    store,
    notify,
    now = new Date(),
    checkedSourceIds = [],
    missingThreshold = 3,
    verifyOpportunityUrl,
    maxNotifications = Number.POSITIVE_INFINITY,
    maxNotificationsByType = {},
  } = options;
  const state = await store.load();
  const report = {
    discovered: 0, approved: 0, pending: 0, rejected: 0, sent: 0, failed: 0, closed: 0,
    unverifiable: 0,
    deferred: 0, duplicates: 0, sentByType: {}, deferredByType: {}, bySource: {},
  };
  const seenIds = new Set();

  for (const raw of balanceByType(rawItems)) {
    const sourceId = raw?.sourceId || 'unknown';
    const sourceReport = report.bySource[sourceId] ||= {
      candidates: 0, normalized: 0, approved: 0, pending: 0,
      rejected: 0, sent: 0, deferred: 0, duplicates: 0, failed: 0, unverifiable: 0,
    };
    sourceReport.candidates += 1;
    let opportunity;
    try {
      opportunity = normalizeOpportunity(raw, now);
    } catch {
      report.rejected += 1;
      sourceReport.rejected += 1;
      continue;
    }
    sourceReport.normalized += 1;

    const previous = state.opportunities[opportunity.id];
    seenIds.add(opportunity.id);
    const unchanged = previous?.contentHash === opportunity.contentHash;
    const previouslySent = previous && (
      previous.review?.status === REVIEW_STATUS.SENT
      || state.deliveries[previous.dedupeKey]?.status === DELIVERY_STATUS.SENT
    );
    const equivalentSent = previouslySent
      ? null
      : findPreviouslySentEquivalentJob(state, opportunity);
    if (previous) opportunity.firstSeenAt = previous.firstSeenAt;
    if (previouslySent) {
      opportunity.eventType = previous.eventType || EVENT_TYPES.DISCOVERED;
      opportunity.dedupeKey = previous.dedupeKey;
      opportunity.review = previous.review || { status: REVIEW_STATUS.SENT, reason: '기존 발송 완료' };
    } else if (equivalentSent) {
      opportunity.eventType = EVENT_TYPES.DISCOVERED;
      opportunity.review = {
        status: REVIEW_STATUS.SENT,
        reason: `동일 채용공고 발송 완료: ${equivalentSent.id}`,
      };
      state.deliveries[opportunity.dedupeKey] = {
        status: DELIVERY_STATUS.SENT,
        opportunityId: opportunity.id,
        sentAt: now.toISOString(),
        suppressedDuplicate: true,
        duplicateOf: equivalentSent.id,
      };
      report.duplicates += 1;
      sourceReport.duplicates += 1;
    } else if (unchanged) {
      opportunity.eventType = previous.eventType || EVENT_TYPES.DISCOVERED;
      opportunity.dedupeKey = previous.dedupeKey;
      opportunity.review = previous.review;
    } else if (previous) {
      opportunity.eventType = EVENT_TYPES.UPDATED;
      opportunity.dedupeKey = `updated:${opportunity.id}:${opportunity.contentHash}`;
    } else {
      opportunity.eventType = EVENT_TYPES.DISCOVERED;
    }
    if (
      !opportunity.review
      && state.deliveries[opportunity.dedupeKey]?.status === DELIVERY_STATUS.SENT
    ) {
      opportunity.review = { status: REVIEW_STATUS.SENT, reason: '발송 이력에서 복구' };
    }
    opportunity.lifecycle = { ...(previous?.lifecycle || {}), missingRuns: 0 };
    delete opportunity.lifecycle.closedAt;
    delete opportunity.lifecycle.closeReason;
    state.opportunities[opportunity.id] = opportunity;
    report.discovered += previous ? 0 : 1;

    if (state.deliveries[opportunity.dedupeKey]?.status === DELIVERY_STATUS.SENT) continue;

    const validation = validateMinimum(opportunity, now);
    if (!validation.valid) {
      state.opportunities[opportunity.id].review = { status: 'REJECTED', reasons: validation.errors };
      report.rejected += 1;
      sourceReport.rejected += 1;
      continue;
    }

    let decision = applyProfileFilter(opportunity, profile);
    if (decision.decision === 'PENDING_BENEFIT') {
      if (!state.pending[opportunity.id]) {
        state.pending[opportunity.id] = { createdAt: now.toISOString(), reason: decision.reason };
        state.opportunities[opportunity.id].review = { status: 'PENDING_BENEFIT', reason: decision.reason };
        report.pending += 1;
        sourceReport.pending += 1;
        continue;
      }
      decision = assessBenefit(opportunity, profile.benefit.approvalThreshold);
      delete state.pending[opportunity.id];
    }

    if (decision.decision !== 'APPROVED') {
      state.opportunities[opportunity.id].review = { status: 'REJECTED', reason: decision.reason };
      report.rejected += 1;
      sourceReport.rejected += 1;
      continue;
    }

    report.approved += 1;
    sourceReport.approved += 1;
    state.opportunities[opportunity.id].review = { status: 'APPROVED', reason: decision.reason };
    let acceptedUnverifiable = false;
    if (verifyOpportunityUrl) {
      try {
        const verification = await verifyOpportunityUrl(opportunity.canonicalUrl);
        const verdict = verification.verdict
          || (verification.ok ? URL_VERDICTS.VALID : URL_VERDICTS.INVALID);
        const acceptedViaTrustedSource = verdict === URL_VERDICTS.UNVERIFIABLE
          && opportunity.attributes?.sourceTrust === 'AGGREGATOR_DETAIL';
        state.opportunities[opportunity.id].verification = {
          ...verification,
          verdict,
          acceptedViaTrustedSource,
          checkedAt: now.toISOString(),
        };
        if (acceptedViaTrustedSource) {
          acceptedUnverifiable = true;
        } else if (verdict !== URL_VERDICTS.VALID) {
          state.opportunities[opportunity.id].review = {
            status: 'REJECTED',
            reason: verdict === URL_VERDICTS.UNVERIFIABLE
              ? `원문 URL 검증 불가: HTTP ${verification.status}`
              : `원문 URL 접근 실패: HTTP ${verification.status}`,
          };
          report.approved -= 1;
          report.rejected += 1;
          sourceReport.approved -= 1;
          sourceReport.rejected += 1;
          continue;
        }
      } catch (error) {
        state.opportunities[opportunity.id].review = {
          status: 'REJECTED', reason: `원문 URL 확인 실패: ${error.message}`,
        };
        report.approved -= 1;
        report.rejected += 1;
        sourceReport.approved -= 1;
        sourceReport.rejected += 1;
        continue;
      }
    }
    const configuredTypeLimit = Number(maxNotificationsByType[opportunity.type]);
    if (
      Number.isFinite(configuredTypeLimit)
      && configuredTypeLimit >= 0
      && (report.sentByType[opportunity.type] || 0) >= configuredTypeLimit
    ) {
      state.opportunities[opportunity.id].review = {
        status: REVIEW_STATUS.DEFERRED,
        reason: `${opportunity.type} 실행당 발송 상한 ${configuredTypeLimit}건 초과`,
      };
      report.deferred += 1;
      sourceReport.deferred += 1;
      report.deferredByType[opportunity.type] = (report.deferredByType[opportunity.type] || 0) + 1;
      continue;
    }
    if (report.sent >= maxNotifications) {
      state.opportunities[opportunity.id].review = {
        status: REVIEW_STATUS.DEFERRED,
        reason: `실행당 발송 상한 ${maxNotifications}건 초과`,
      };
      report.deferred += 1;
      sourceReport.deferred += 1;
      report.deferredByType[opportunity.type] = (report.deferredByType[opportunity.type] || 0) + 1;
      continue;
    }
    let message;
    try {
      message = await notify(opportunity);
    } catch (error) {
      state.deliveries[opportunity.dedupeKey] = {
        status: DELIVERY_STATUS.FAILED,
        opportunityId: opportunity.id,
        attemptedAt: now.toISOString(),
        error: error.message,
      };
      report.failed += 1;
      sourceReport.failed += 1;
      await store.save(state);
      continue;
    }
    state.deliveries[opportunity.dedupeKey] = {
      status: DELIVERY_STATUS.SENT,
      opportunityId: opportunity.id,
      sentAt: now.toISOString(),
      messageId: message?.id || null,
    };
    state.opportunities[opportunity.id].review.status = REVIEW_STATUS.SENT;
    report.sent += 1;
    sourceReport.sent += 1;
    if (acceptedUnverifiable) {
      report.unverifiable += 1;
      sourceReport.unverifiable += 1;
    }
    report.sentByType[opportunity.type] = (report.sentByType[opportunity.type] || 0) + 1;
    await store.save(state);
  }

  const checked = new Set(checkedSourceIds);
  if (checked.size) {
    for (const opportunity of Object.values(state.opportunities)) {
      if (!checked.has(opportunity.sourceId) || seenIds.has(opportunity.id)) continue;
      const missingRuns = (opportunity.lifecycle?.missingRuns || 0) + 1;
      opportunity.lifecycle = { ...(opportunity.lifecycle || {}), missingRuns };
      if (opportunity.status === OPPORTUNITY_STATUS.OPEN && missingRuns >= missingThreshold) {
        opportunity.status = OPPORTUNITY_STATUS.CLOSED;
        opportunity.lifecycle.closedAt = now.toISOString();
        opportunity.lifecycle.closeReason = '공식 출처에서 연속 미확인';
        report.closed += 1;
      }
    }
  }

  await store.save(state);
  return report;
}

module.exports = { balanceByType, runRadar };
