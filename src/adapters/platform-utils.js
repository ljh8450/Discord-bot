const TECH_TERMS = [
  '개발', '개발자', '프로그래밍', '코딩', '소프트웨어', '해커톤', '데이터', '인공지능',
  '웹', '앱', '백엔드', '프론트엔드', '클라우드', '보안',
  'github', '오픈소스', '로봇', 'devops', 'server', '서버',
];

function isTechRelevant(...values) {
  const text = values.flat(Infinity).filter(Boolean).join(' ').toLowerCase();
  return TECH_TERMS.some((term) => text.includes(term))
    || /(^|[^a-z0-9])(ai|it|web|iot)([^a-z0-9]|$)/i.test(text);
}

function hasDevelopmentOutput(...values) {
  const text = values.flat(Infinity).filter(Boolean).join(' ').toLowerCase();
  return [
    /\uac1c\ubc1c/, /\ud574\ucee4\ud1a4/, /\ucf54\ub529/, /\ud504\ub85c\uadf8\ub798\ubc0d/,
    /\uc18c\ud504\ud2b8\uc6e8\uc5b4/, /\ub370\uc774\ud130/, /\uc54c\uace0\ub9ac\uc998/,
    /\ubcf4\uc548/, /\ud074\ub77c\uc6b0\ub4dc/, /\ubc31\uc5d4\ub4dc/, /\ud504\ub860\ud2b8\uc5d4\ub4dc/,
    /developer|engineer|hackathon|coding|programming|software|backend|frontend|fullstack/,
    /(^|[^a-z])(api|llm|data|algorithm|security|cloud|web|app)([^a-z]|$)/,
  ].some((pattern) => pattern.test(text));
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
