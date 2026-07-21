const AGGREGATOR_SOURCES = [
  { id: 'linkareer', kind: 'linkareer', enabled: true, priority: 100,
    routes: ['contest', 'education', 'activity'], maxItemsPerRoute: 20 },
  { id: 'campuspick', kind: 'campuspick', enabled: true, priority: 80,
    routes: ['contest', 'activity'], maxItemsPerRoute: 20, allowEmpty: true },
  { id: 'ticketa', kind: 'ticketa', enabled: true, priority: 70, allowEmpty: true,
    url: 'https://vlizxsubseudvtswwsjd.supabase.co/functions/v1/events?locale=ko', maxItems: 30 },
  { id: 'eventus', kind: 'eventus', enabled: true, priority: 70, allowEmpty: true,
    url: 'https://event-us.kr/search', categories: ['IT/프로그래밍', '과학기술', '커리어'], maxItems: 30 },
];

const OPPORTUNITY_SOURCES = [
  { id: 'dacon-ai-competitions', kind: 'dacon', enabled: true, priority: 60, url: 'https://dacon.io/' },
  {
    id: 'gdg-korea-events', kind: 'gdg-events', enabled: true, priority: 60, maxItems: 30, allowEmpty: true,
    urls: [
      'https://gdg.community.dev/gdg-seoul/',
      'https://gdg.community.dev/gdg-korea-android/',
      'https://gdg.community.dev/gdg-golang-korea/',
    ],
  },
  {
    id: 'programmers-devcourse', kind: 'programmers-education', enabled: true, priority: 60,
    url: 'https://programmers.co.kr/pages/edu-devcourse', maxItems: 20, allowEmpty: true,
  },
];

const BRIEF_SOURCES = [
  {
    id: 'geeknews-popular', kind: 'geeknews', enabled: true, url: 'https://news.hada.io/',
    organization: 'GeekNews', tags: ['개발', 'AI', '커뮤니티'], priority: 100,
    authority: 2, practicalValue: 2, minPoints: 5, maxRank: 20, maxItems: 15,
  },
  {
    id: 'openai-news', kind: 'rss', enabled: true, url: 'https://openai.com/news/rss.xml',
    organization: 'OpenAI', tags: ['AI', '모델', '개발 도구'], authority: 3,
    practicalValue: 2, maxItems: 30,
  },
  {
    id: 'github-blog', kind: 'rss', enabled: true, url: 'https://github.blog/feed/',
    organization: 'GitHub', tags: ['개발', 'GitHub', 'Copilot'], authority: 3,
    practicalValue: 3, maxItems: 30,
  },
  {
    id: 'google-developers-blog', kind: 'rss', enabled: true,
    url: 'https://developers.googleblog.com/feeds/posts/default?alt=rss',
    organization: 'Google Developers', tags: ['개발', 'AI', 'Google'], authority: 3,
    practicalValue: 2, maxItems: 30,
  },
  {
    id: 'naver-d2', kind: 'rss', enabled: true, url: 'https://d2.naver.com/d2.atom',
    organization: 'NAVER D2', tags: ['개발', '백엔드', '프론트엔드', 'AI'],
    authority: 3, practicalValue: 3, maxItems: 30,
  },
  {
    id: 'kakao-tech', kind: 'rss', enabled: true, url: 'https://tech.kakao.com/feed/',
    organization: 'Kakao Tech', tags: ['개발', '백엔드', '프론트엔드', 'AI'],
    authority: 3, practicalValue: 3, maxItems: 30,
  },
  {
    id: 'toss-tech', kind: 'rss', enabled: true, url: 'https://toss.tech/rss.xml',
    organization: '토스 기술 블로그', tags: ['개발', '백엔드', '프론트엔드', '데이터'],
    authority: 3, practicalValue: 3, maxItems: 30,
  },
  {
    id: 'daangn-tech', kind: 'rss', enabled: true, url: 'https://medium.com/feed/daangn',
    organization: '당근 기술 블로그', tags: ['개발', '백엔드', '프론트엔드', '데이터'],
    authority: 3, practicalValue: 3, maxItems: 30,
  },
  {
    id: 'youtube-silicon-valley-developer', kind: 'youtube', enabled: true,
    channelId: 'UC6VbqOLKkdDhdtnhuTYPKxA', organization: '실밸개발자',
    tags: ['AI', '개발', '개발자 커리어'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-ai-frontier-korea', kind: 'youtube', enabled: true,
    channelId: 'UCz-BiVywYdO6iXhjXkw_Kgw', organization: 'AI Frontier Korea',
    tags: ['AI', 'LLM', 'Agent'], authority: 2, practicalValue: 2,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-tech-bridge', kind: 'youtube', enabled: true,
    channelId: 'UC895rbZX2iXLTDfji7W4PfA', organization: 'Tech Bridge',
    tags: ['AI', '개발', '글로벌 테크'], authority: 2, practicalValue: 2,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-midnight-log', kind: 'youtube', enabled: true,
    channelId: 'UC64nZb1bXGZfEXaFSvK15dw', organization: '미드나잇 로그 Midnight Log',
    tags: ['AI', '개발', '바이브 코딩'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-jocoding', kind: 'youtube', enabled: true,
    channelId: 'UCQNE2JmbasNYbjGAcuBiRRg', organization: '조코딩 JoCoding',
    tags: ['AI', '개발', '코딩'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-eo-korea', kind: 'youtube', enabled: true,
    channelId: 'UCQ2DWm5Md16Dc3xRwwhVE7Q', organization: 'EO Korea',
    tags: ['AI', '스타트업', '개발 조직'], authority: 2, practicalValue: 2,
    includeTerms: ['AI', '인공지능', '개발자', '엔지니어', '개발 조직', '기술 조직'],
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-unrealtech', kind: 'youtube', enabled: true,
    channelId: 'UCeN2YeJcBCRJoXgzF_OU3qw', organization: '안될공학',
    tags: ['AI', '인프라', '개발 도구'], authority: 2, practicalValue: 2,
    includeTerms: ['AI', 'LLM', 'GPU', '인공지능', '반도체', '개발 도구', '클라우드', '코딩'],
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
];

module.exports = { AGGREGATOR_SOURCES, BRIEF_SOURCES, OPPORTUNITY_SOURCES };
