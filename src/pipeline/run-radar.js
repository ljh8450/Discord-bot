const { applyProfileFilter } = require('../domain/filter');
const { normalizeOpportunity } = require('../domain/opportunity');
const { assessBenefit, validateMinimum } = require('../domain/validation');

const NOTIFICATION_TYPE_ORDER = ['HACKATHON', 'JOB', 'EXTERNAL_ACTIVITY', 'EDUCATION', 'CONTENT'];

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
    deferred: 0, sentByType: {}, deferredByType: {}, bySource: {},
  };
  const seenIds = new Set();

  for (const raw of balanceByType(rawItems)) {
    const sourceId = raw?.sourceId || 'unknown';
    const sourceReport = report.bySource[sourceId] ||= {
      candidates: 0, normalized: 0, approved: 0, pending: 0,
      rejected: 0, sent: 0, deferred: 0, failed: 0,
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
      previous.review?.status === 'SENT'
      || state.deliveries[previous.dedupeKey]?.status === 'SENT'
    );
    if (previous) opportunity.firstSeenAt = previous.firstSeenAt;
    if (previouslySent) {
      opportunity.eventType = previous.eventType || 'DISCOVERED';
      opportunity.dedupeKey = previous.dedupeKey;
      opportunity.review = previous.review || { status: 'SENT', reason: '기존 발송 완료' };
    } else if (unchanged) {
      opportunity.eventType = previous.eventType || 'DISCOVERED';
      opportunity.dedupeKey = previous.dedupeKey;
      opportunity.review = previous.review;
    } else if (previous) {
      opportunity.eventType = 'UPDATED';
      opportunity.dedupeKey = `updated:${opportunity.id}:${opportunity.contentHash}`;
    } else {
      opportunity.eventType = 'DISCOVERED';
    }
    if (
      !opportunity.review
      && state.deliveries[opportunity.dedupeKey]?.status === 'SENT'
    ) {
      opportunity.review = { status: 'SENT', reason: '발송 이력에서 복구' };
    }
    opportunity.lifecycle = { ...(previous?.lifecycle || {}), missingRuns: 0 };
    delete opportunity.lifecycle.closedAt;
    delete opportunity.lifecycle.closeReason;
    state.opportunities[opportunity.id] = opportunity;
    report.discovered += previous ? 0 : 1;

    if (state.deliveries[opportunity.dedupeKey]?.status === 'SENT') continue;

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
    if (verifyOpportunityUrl) {
      try {
        const verification = await verifyOpportunityUrl(opportunity.canonicalUrl);
        state.opportunities[opportunity.id].verification = {
          ...verification,
          checkedAt: now.toISOString(),
        };
        if (!verification.ok) {
          state.opportunities[opportunity.id].review = {
            status: 'REJECTED',
            reason: `원문 URL 접근 실패: HTTP ${verification.status}`,
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
        status: 'DEFERRED',
        reason: `${opportunity.type} 실행당 발송 상한 ${configuredTypeLimit}건 초과`,
      };
      report.deferred += 1;
      sourceReport.deferred += 1;
      report.deferredByType[opportunity.type] = (report.deferredByType[opportunity.type] || 0) + 1;
      continue;
    }
    if (report.sent >= maxNotifications) {
      state.opportunities[opportunity.id].review = {
        status: 'DEFERRED',
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
        status: 'FAILED',
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
      status: 'SENT',
      opportunityId: opportunity.id,
      sentAt: now.toISOString(),
      messageId: message?.id || null,
    };
    state.opportunities[opportunity.id].review.status = 'SENT';
    report.sent += 1;
    sourceReport.sent += 1;
    report.sentByType[opportunity.type] = (report.sentByType[opportunity.type] || 0) + 1;
    await store.save(state);
  }

  const checked = new Set(checkedSourceIds);
  if (checked.size) {
    for (const opportunity of Object.values(state.opportunities)) {
      if (!checked.has(opportunity.sourceId) || seenIds.has(opportunity.id)) continue;
      const missingRuns = (opportunity.lifecycle?.missingRuns || 0) + 1;
      opportunity.lifecycle = { ...(opportunity.lifecycle || {}), missingRuns };
      if (opportunity.status === 'OPEN' && missingRuns >= missingThreshold) {
        opportunity.status = 'CLOSED';
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
