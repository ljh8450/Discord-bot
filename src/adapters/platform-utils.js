const { hasDevelopmentOutput } = require('../domain/development-relevance');

const TECH_TERMS = [
  '개발', '개발자', '프로그래밍', '코딩', '소프트웨어', '해커톤', '데이터', '인공지능',
  '웹', '앱', '백엔드', '프론트엔드', '클라우드', '보안',
  'github', '오픈소스', '로봇', 'devops', 'server', '서버',
  '블록체인', '웹3', 'web3', 'blockchain', 'smart contract', 'dapp', '프로토콜',
  'protocol camp', 'giwa', 'gasok',
];

function isTechRelevant(...values) {
  const text = values.flat(Infinity).filter(Boolean).join(' ').toLowerCase();
  return TECH_TERMS.some((term) => text.includes(term))
    || /(^|[^a-z0-9])(ai|it|web|iot)([^a-z0-9]|$)/i.test(text);
}

function extractJsonScript(html, id) {
  const pattern = '<script[^>]+id=.' + id + '.[^>]*>([\\s\\S]*?)<\\/script>';
  const value = html.match(new RegExp(pattern, 'i'))?.[1];
  return value ? JSON.parse(value) : null;
}

function inferType(title, fallback = 'EXTERNAL_ACTIVITY') {
  return /해커톤|공모전|경진대회|contest|competition/i.test(title || '') ? 'HACKATHON' : fallback;
}

function requestOptions() {
  return { headers: { 'user-agent': 'Mozilla/5.0 OpportunityRadar/1.0' }, signal: AbortSignal.timeout(30_000) };
}

module.exports = { extractJsonScript, hasDevelopmentOutput, inferType, isTechRelevant, requestOptions };
