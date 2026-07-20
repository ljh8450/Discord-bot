const { applyProfileFilter } = require('../domain/filter');
const { normalizeOpportunity } = require('../domain/opportunity');
const { assessBenefit, validateMinimum } = require('../domain/validation');

async function runRadar(options) {
  const {
    rawItems,
    profile,
    store,
    notify,
    now = new Date(),
  } = options;
  const state = await store.load();
  const report = { discovered: 0, approved: 0, pending: 0, rejected: 0, sent: 0, failed: 0 };

  for (const raw of rawItems) {
    let opportunity;
    try {
      opportunity = normalizeOpportunity(raw, now);
    } catch {
      report.rejected += 1;
      continue;
    }

    const previous = state.opportunities[opportunity.id];
    const unchanged = previous?.contentHash === opportunity.contentHash;
    if (previous) opportunity.firstSeenAt = previous.firstSeenAt;
    if (unchanged) {
      opportunity.lastSeenAt = previous.lastSeenAt;
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
    state.opportunities[opportunity.id] = opportunity;
    report.discovered += previous ? 0 : 1;

    if (state.deliveries[opportunity.dedupeKey]?.status === 'SENT') continue;

    const validation = validateMinimum(opportunity, now);
    if (!validation.valid) {
      state.opportunities[opportunity.id].review = { status: 'REJECTED', reasons: validation.errors };
      report.rejected += 1;
      continue;
    }

    let decision = applyProfileFilter(opportunity, profile);
    if (decision.decision === 'PENDING_BENEFIT') {
      if (!state.pending[opportunity.id]) {
        state.pending[opportunity.id] = { createdAt: now.toISOString(), reason: decision.reason };
        state.opportunities[opportunity.id].review = { status: 'PENDING_BENEFIT', reason: decision.reason };
        report.pending += 1;
        continue;
      }
      decision = assessBenefit(opportunity, profile.benefit.approvalThreshold);
      delete state.pending[opportunity.id];
    }

    if (decision.decision !== 'APPROVED') {
      state.opportunities[opportunity.id].review = { status: 'REJECTED', reason: decision.reason };
      report.rejected += 1;
      continue;
    }

    report.approved += 1;
    state.opportunities[opportunity.id].review = { status: 'APPROVED', reason: decision.reason };
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
    await store.save(state);
  }

  await store.save(state);
  return report;
}

module.exports = { runRadar };
