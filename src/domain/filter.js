const { TYPES } = require('./opportunity');
const { hasDevelopmentOutput } = require('./development-relevance');

function searchableText(opportunity) {
  return [
    opportunity.title,
    opportunity.organization,
    ...opportunity.tags,
    ...opportunity.eligibility,
    ...opportunity.locations,
    opportunity.summary,
  ].join(' ').toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(String(term).toLowerCase()));
}

const TRAINING_PROGRAM_PATTERNS = [
  /부트\s*캠프|boot\s*camp/i,
  /(?:교육생|수강생|훈련생)\s*모집/i,
  /(?:전문가|엔지니어|관리자|인재)\s*양성\s*(?:과정|교육|프로그램)?/i,
  /양성\s*과정/i,
  /(?:국비|k-?digital|kdt|훈련\s*수당).{0,40}(?:교육|과정|아카데미|academy|훈련)/i,
  /(?:아카데미|academy).{0,30}(?:교육생|수강생)\s*모집/i,
  /(?:사용자|재직자|중소기업).{0,50}(?:기본\s*)?교육/i,
];

const QUALIFICATION_PROGRAM_PATTERNS = [
  /자격증|자격\s*시험/i,
  /(?:정보관리|컴퓨터시스템응용)?\s*기술사/i,
  /(?:기사|산업기사).{0,20}(?:필기|실기|검정|시험|설명회)/i,
];

function excludedProgramReason(opportunity) {
  const text = searchableText(opportunity);
  if (TRAINING_PROGRAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return '부트캠프·직업교육 과정 제외';
  }
  if (QUALIFICATION_PROGRAM_PATTERNS.some((pattern) => pattern.test(opportunity.title))) {
    return '자격증·기술사 과정 제외';
  }
  return null;
}

function filterJob(opportunity, profile) {
  const text = searchableText(opportunity);
  const allowedOrganization = profile.job.organizationAllowlist
    .some((name) => opportunity.organization.toLowerCase().includes(name.toLowerCase()));
  const entryLevel = includesAny(text, profile.job.entryLevelTerms);
  const metropolitan = includesAny(
    opportunity.locations.join(' ').toLowerCase(),
    profile.job.locations,
  );
  const preferredRole = includesAny(text, profile.job.preferredRoles);
  const developerRole = preferredRole || includesAny(text, profile.job.developerRoleTerms || []);
  const conservative = includesAny(text, profile.job.conservativeTerms);

  if (!entryLevel) return { decision: 'REJECTED', reason: '신입 또는 인턴 지원 가능 근거 없음' };
  if (!metropolitan) return { decision: 'REJECTED', reason: '수도권 또는 원격 근무 조건 불일치' };
  if (conservative && !allowedOrganization) {
    return { decision: 'REJECTED', reason: '보수적 노출 직무이며 allowlist 기업이 아님' };
  }
  if (!preferredRole && !(allowedOrganization && developerRole)) {
    return { decision: 'REJECTED', reason: '선호 직무 조건 불일치' };
  }
  return { decision: 'APPROVED', reason: allowedOrganization ? 'allowlist 기업' : '채용 하드 필터 통과' };
}

function filterHackathon(opportunity) {
  const excludedReason = excludedProgramReason(opportunity);
  if (excludedReason) return { decision: 'REJECTED', reason: excludedReason };

  if (opportunity.attributes.platformDeveloperEvent === true) {
    return { decision: 'APPROVED', reason: '개발자 행사 출처' };
  }
  if (
    opportunity.attributes.developmentOutput === true
    && hasDevelopmentOutput(
      opportunity.title,
      opportunity.organization,
      opportunity.tags,
      opportunity.summary,
    )
  ) {
    return { decision: 'APPROVED', reason: '개발 결과물을 만드는 행사' };
  }
  return { decision: 'REJECTED', reason: '개발 결과물 행사 근거 없음' };
}

function filterEducation(opportunity) {
  const text = searchableText(opportunity);
  const immediate = ['개발 동아리', '기업 주관', '멘토링'];
  const needsBenefitReview = ['유료', '부트캠프', '정부 지원', '창업', '서포터즈', '풀타임'];

  if (includesAny(text, needsBenefitReview) || opportunity.attributes.requiresBenefitReview === true) {
    return { decision: 'PENDING_BENEFIT', reason: '비용·기간 대비 혜택 추가 심사 필요' };
  }
  if (includesAny(text, immediate) || opportunity.attributes.immediateCategory === true) {
    return { decision: 'APPROVED', reason: '즉시 통과 교육·활동 유형' };
  }
  return { decision: 'REJECTED', reason: '교육·활동 통과 기준 불충족' };
}

function filterExternalActivity(opportunity) {
  const text = searchableText(opportunity);
  const immediate = ['개발 동아리', '멘토링'];
  const needsBenefitReview = ['유료', '창업', '서포터즈', '풀타임'];
  const conservativeAggregator = ['linkareer', 'campuspick'].includes(opportunity.sourceId);
  const excludedReason = excludedProgramReason(opportunity);

  if (excludedReason) return { decision: 'REJECTED', reason: excludedReason };
  if (includesAny(text, needsBenefitReview) || opportunity.attributes.requiresBenefitReview === true) {
    return { decision: 'PENDING_BENEFIT', reason: '시간 부담 대비 활동 혜택 추가 심사 필요' };
  }
  if (opportunity.attributes.platformDeveloperEvent === true) {
    if (!hasDevelopmentOutput(
      opportunity.title,
      opportunity.organization,
      opportunity.tags,
      opportunity.summary,
    )) {
      return { decision: 'REJECTED', reason: '비개발 행사·기획 활동 제외' };
    }
    return { decision: 'APPROVED', reason: '개발자 포럼·컨퍼런스·강연·세미나' };
  }
  if (conservativeAggregator && opportunity.attributes.verifiedDevelopmentActivity !== true) {
    return { decision: 'REJECTED', reason: '명시적인 개발 결과물 근거 없음' };
  }
  if (conservativeAggregator) {
    return { decision: 'APPROVED', reason: '명시적인 개발 결과물 활동' };
  }
  if (includesAny(text, immediate) || opportunity.attributes.immediateCategory === true) {
    return { decision: 'APPROVED', reason: '개발 대외활동 통과 기준 충족' };
  }
  return { decision: 'REJECTED', reason: '대외활동 통과 기준 불충족' };
}

function applyProfileFilter(opportunity, profile) {
  if (opportunity.type === TYPES.JOB) return filterJob(opportunity, profile);
  if (opportunity.type === TYPES.HACKATHON) return filterHackathon(opportunity);
  if (opportunity.type === TYPES.EXTERNAL_ACTIVITY) return filterExternalActivity(opportunity);
  if (opportunity.type === TYPES.EDUCATION) return filterEducation(opportunity);
  if (opportunity.type === TYPES.CONTENT) {
    return { decision: 'REJECTED', reason: '오전 9시 일일 인사이트 파이프라인 대상' };
  }
  return { decision: 'REJECTED', reason: '지원하지 않는 유형' };
}

module.exports = { applyProfileFilter };
