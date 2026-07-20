const DEVELOPMENT_PATTERNS = [
  /\uac1c\ubc1c/, /\ud574\ucee4\ud1a4/, /\ucf54\ub529/, /\ud504\ub85c\uadf8\ub798\ubc0d/,
  /\uc18c\ud504\ud2b8\uc6e8\uc5b4/, /\ub370\uc774\ud130/, /\uc54c\uace0\ub9ac\uc998/,
  /\ubcf4\uc548/, /\ud074\ub77c\uc6b0\ub4dc/, /\ubc31\uc5d4\ub4dc/, /\ud504\ub860\ud2b8\uc5d4\ub4dc/,
  /developer|engineer|hackathon|coding|programming|software|backend|frontend|fullstack/,
  /(^|[^a-z])(api|llm|data|algorithm|security|cloud|web|app)([^a-z]|$)/,
];

const CREATIVE_PATTERNS = [
  /\uc601\ud654/, /\uc601\uc0c1/, /\uc20f\s*\ud3fc/, /\uc20f\s*\ud544\ub984/,
  /\ubbf8\ub514\uc5b4\s*\uc544\ud2b8/, /\uc0ac\uc9c4/, /\uc6f9\ud230/, /\ud3ec\uc2a4\ud130/,
  /\ub514\uc790\uc778/, /\uad11\uace0/, /\uc2dc\ub098\ub9ac\uc624/, /\ubb38\ud559/,
  /\uc74c\uc545/, /\ubbf8\uc220/, /\uc77c\ub7ec\uc2a4\ud2b8/, /\ucf58\ud150\uce20\s*\uc81c\uc791/,
  /\bucc\b/i,
];

const EXPLICIT_IMPLEMENTATION_PATTERNS = [
  /(^|[^a-z])api([^a-z]|$)/,
  /\uc571\s*(?:\uc11c\ube44\uc2a4\s*)?\uac1c\ubc1c/,
  /\uc6f9\s*(?:\uc11c\ube44\uc2a4\s*)?\uac1c\ubc1c/,
  /\uc11c\ube44\uc2a4\s*(?:\uc124\uacc4|\uac1c\ubc1c|\uad6c\ud604)/,
  /\uc18c\ud504\ud2b8\uc6e8\uc5b4\s*(?:\uc124\uacc4|\uac1c\ubc1c|\uad6c\ud604)/,
  /\ucf54\ub4dc\s*(?:\uc791\uc131|\uac1c\ubc1c|\uad6c\ud604|\uc81c\ucd9c)/,
  /\ub3c4\uad6c\s*(?:\uc124\uacc4|\uac1c\ubc1c|\uad6c\ud604)/,
  /\ud504\ub85c\ud1a0\ud0c0\uc785/, /\ub370\uc774\ud130\s*\ubd84\uc11d/,
  /\ubaa8\ub378\s*(?:\uac1c\ubc1c|\ud559\uc2b5|\uad6c\ud604)/,
  /\ucef4\ud4e8\ud130\s*\ube44\uc804/, /\uc54c\uace0\ub9ac\uc998/, /github/,
  /software|backend|frontend|fullstack|computer\s*vision|prototype/,
];

function relevanceText(values) {
  return values.flat(Infinity).filter(Boolean).join(' ').toLowerCase();
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function hasDevelopmentOutput(...values) {
  const text = relevanceText(values);
  if (!matchesAny(text, DEVELOPMENT_PATTERNS)) return false;
  if (!matchesAny(text, CREATIVE_PATTERNS)) return true;
  return matchesAny(text, EXPLICIT_IMPLEMENTATION_PATTERNS);
}

module.exports = { hasDevelopmentOutput };
