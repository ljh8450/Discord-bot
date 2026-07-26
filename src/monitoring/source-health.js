function buildCollectionWarnings(options = {}) {
  const {
    sources = [],
    successfulSourceIds = [],
    sourceCounts = {},
    skippedSources = [],
    report = {},
  } = options;
  const allowEmpty = new Set(
    sources.filter((source) => source.allowEmpty).map((source) => source.id),
  );
  const warnings = successfulSourceIds
    .filter((sourceId) => sourceCounts[sourceId] === 0 && !allowEmpty.has(sourceId))
    .map((sourceId) => `${sourceId}: 수집 결과가 0건이어서 종료 판정을 보류했습니다.`);

  warnings.push(...skippedSources.map((source) => (
    `${source.sourceId}: ${source.reason} 때문에 수집을 건너뛰었습니다.`
  )));

  if (report.unverifiable) {
    warnings.push(
      `원문 URL이 봇 차단으로 검증되지 않은 ${report.unverifiable}건을 상세 수집 근거로 발송했습니다.`,
    );
  }
  return warnings;
}

module.exports = { buildCollectionWarnings };
