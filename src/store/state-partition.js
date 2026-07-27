const { createEmptyState, hydrateState } = require('./state-contract');

function partitionEntries(entries, briefOpportunityIds, fallbackToBrief = () => false) {
  const radar = {};
  const brief = {};
  for (const [key, value] of Object.entries(entries || {})) {
    const isBrief = briefOpportunityIds.has(value?.opportunityId)
      || briefOpportunityIds.has(key)
      || fallbackToBrief(key, value);
    (isBrief ? brief : radar)[key] = value;
  }
  return { radar, brief };
}

function partitionLegacyState(input) {
  const state = hydrateState(input);
  const radarState = createEmptyState();
  const briefState = createEmptyState();
  const briefOpportunityIds = new Set();

  for (const [id, opportunity] of Object.entries(state.opportunities)) {
    if (opportunity.type === 'CONTENT') {
      briefState.opportunities[id] = opportunity;
      briefOpportunityIds.add(id);
    } else {
      radarState.opportunities[id] = opportunity;
    }
  }

  const deliveries = partitionEntries(
    state.deliveries,
    briefOpportunityIds,
    (key) => key.startsWith('brief:'),
  );
  radarState.deliveries = deliveries.radar;
  briefState.deliveries = deliveries.brief;

  const pending = partitionEntries(state.pending, briefOpportunityIds);
  radarState.pending = pending.radar;
  briefState.pending = pending.brief;

  for (const feedback of state.feedback) {
    const target = briefOpportunityIds.has(feedback?.opportunityId)
      ? briefState.feedback
      : radarState.feedback;
    target.push(feedback);
  }

  return { radarState, briefState };
}

module.exports = { partitionLegacyState };