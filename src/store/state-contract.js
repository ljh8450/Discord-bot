const STATE_COLLECTIONS = Object.freeze({
  opportunities: 'object',
  deliveries: 'object',
  pending: 'object',
  feedback: 'array',
});

function createEmptyState() {
  return {
    opportunities: {},
    deliveries: {},
    pending: {},
    // Reserved for the deferred feedback feature; no writer exists in the current scope.
    feedback: [],
  };
}

function hydrateState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('state must be an object');
  }

  const state = { ...createEmptyState(), ...value };
  for (const [key, expected] of Object.entries(STATE_COLLECTIONS)) {
    const actual = Array.isArray(state[key])
      ? 'array'
      : state[key] && typeof state[key] === 'object'
        ? 'object'
        : typeof state[key];
    if (actual !== expected) {
      throw new TypeError(`state.${key} must be an ${expected}`);
    }
  }
  return state;
}

module.exports = {
  STATE_COLLECTIONS,
  createEmptyState,
  hydrateState,
};
