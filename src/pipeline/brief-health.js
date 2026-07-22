function classifyBriefSourceErrors(errors, successfulSourceIds) {
  if (!errors.length) return { errors: [], warnings: [] };
  if (!successfulSourceIds.length) return { errors, warnings: [] };
  return {
    errors: [],
    warnings: errors.map((item) => `${item.sourceId}: ${item.error}`),
  };
}

module.exports = { classifyBriefSourceErrors };
