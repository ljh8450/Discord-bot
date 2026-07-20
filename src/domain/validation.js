function validateMinimum(opportunity, now = new Date()) {
  const errors = [];
  if (!opportunity.canonicalUrl.startsWith('http')) errors.push('원문 URL 없음');
  if (opportunity.status !== 'OPEN') errors.push('현재 모집 중이 아님');
  if (opportunity.closesAt && new Date(opportunity.closesAt) < now) errors.push('마감일이 지남');
  if (!opportunity.summary) errors.push('한 줄 요약 없음');
  if (!opportunity.summaryEvidence.length) errors.push('요약 근거 없음');
  if (opportunity.type === 'JOB' && !opportunity.eligibility.length) errors.push('지원 자격 근거 없음');
  return { valid: errors.length === 0, errors };
}

const BENEFIT_FIELDS = [
  'freeOrFunded',
  'financialSupport',
  'trustedOrganizer',
  'industryMentoring',
  'portfolioProject',
  'hiringConnection',
  'completionCertificate',
  'reasonableTimeCommitment',
];

function assessBenefit(opportunity, threshold = 3) {
  const score = BENEFIT_FIELDS.reduce(
    (total, field) => total + (opportunity.attributes[field] === true ? 1 : 0),
    0,
  );
  return {
    decision: score >= threshold ? 'APPROVED' : 'REJECTED',
    reason: `혜택 근거 ${score}/${BENEFIT_FIELDS.length}개`,
    score,
  };
}

module.exports = { assessBenefit, validateMinimum };
