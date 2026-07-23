const AGGREGATOR_SOURCES = [
  { id: 'linkareer', kind: 'linkareer', enabled: true, priority: 100,
    routes: ['contest', 'education', 'activity'], recentDays: 7,
    maxPagesPerRoute: 5, maxItemsPerRoute: 100 },
  { id: 'campuspick', kind: 'campuspick', enabled: true, priority: 80,
    routes: ['contest', 'activity'], recentDays: 7,
    maxPagesPerRoute: 5, maxItemsPerRoute: 100, allowEmpty: true },
  { id: 'ticketa', kind: 'ticketa', enabled: true, priority: 70, allowEmpty: true,
    url: 'https://vlizxsubseudvtswwsjd.supabase.co/functions/v1/events?locale=ko', maxItems: 30 },
  { id: 'eventus', kind: 'eventus', enabled: true, priority: 70, allowEmpty: true,
    url: 'https://event-us.kr/search',
    apiUrl: 'https://api.event-us.kr/api/v1/engine/search',
    categories: ['IT/프로그래밍', '과학기술', '커리어'],
    maxPagesPerCategory: 3, pageSize: 12, maxItems: 100 },
  {
    id: 'eventus-keyword-discovery', kind: 'eventus', enabled: true, priority: 75, allowEmpty: true,
    url: 'https://event-us.kr/search',
    apiUrl: 'https://api.event-us.kr/api/v1/engine/search',
    keywords: ['해커톤', 'AI Agent', '빌더', 'MVP', '개발자'],
    maxKeywordPages: 2, pageSize: 12, maxItems: 100,
  },
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
  {
    id: 'official-curated-developer-programs',
    kind: 'official-opportunity',
    enabled: true,
    priority: 110,
    allowEmpty: true,
    organization: '공식 주최 기관',
    preferredDomains: ['giwa.io', 'upbit.com'],
    tags: ['개발', '빌더', '공식 공지'],
    pages: [
      {
        externalId: 'giwa-gasok-2026',
        url: 'https://giwa.io/gasok?lang=ko',
        applicationUrl: 'https://giwa.io/gasok?lang=ko',
        title: 'UPBIT × GIWA 빌더 성장 지원 프로그램 GASOK',
        organization: '두나무·GIWA',
        type: 'HACKATHON',
        publishedAt: '2026-07-14T00:00:00+09:00',
        closesAt: '2026-07-31T23:59:59+09:00',
        eligibility: ['GIWA 체인에서 프로젝트를 구축 중이거나 구축할 개인 또는 팀'],
        tags: ['Web3', 'dApp', 'MVP', '스마트 컨트랙트'],
        summary: 'GIWA 체인 기반 프로젝트를 개발하고 MVP 데모·웹사이트 또는 스마트 컨트랙트 링크를 제출하는 공식 빌더 프로그램',
        developmentOutput: true,
        financialSupport: true,
      },
    ],
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
    id: 'anthropic-news', kind: 'anthropic-news', enabled: true,
    url: 'https://www.anthropic.com/news', organization: 'Anthropic',
    tags: ['AI', 'Claude', '모델', '개발 도구'], authority: 3,
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
    id: 'woowahan-tech', kind: 'rss', enabled: true,
    url: 'https://techblog.woowahan.com/feed/', organization: '우아한형제들 기술 블로그',
    fallbackUrl: 'https://techblog.woowahan.com/wp-json/wp/v2/posts?per_page=30&_fields=id,link,date,date_gmt,title,excerpt',
    fallbackKind: 'wordpress-rest', retryAttempts: 3,
    fallbacks: [{
      kind: 'feedly',
      url: 'https://cloud.feedly.com/v3/streams/contents?streamId=feed%2Fhttps%3A%2F%2Ftechblog.woowahan.com%2Ffeed%2F&count=30',
    }],
    tags: ['개발', '백엔드', '프론트엔드', '데이터', 'AI'],
    authority: 3, practicalValue: 3, maxItems: 30,
  },
  {
    id: 'lycorp-tech', kind: 'rss', enabled: true,
    url: 'https://techblog.lycorp.co.jp/ko/feed/index.xml', organization: 'LINE·LY 기술 블로그',
    tags: ['개발', '백엔드', '프론트엔드', '데이터', 'AI'],
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
    id: 'youtube-agent-os', kind: 'youtube', enabled: true,
    channelId: 'UC2ODfJSf8L4PeCw4ebTECJQ', organization: 'AgentOS',
    tags: ['AI', 'AI Agent', '개발자 커리어'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-coding-pe', kind: 'youtube', enabled: true,
    channelId: 'UCRpOx7jjy2PuuVeRrYKbdCA', organization: '코딩하는 기술사',
    tags: ['개발', '소프트웨어 아키텍처', '개발자 커리어'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-codingapple', kind: 'youtube', enabled: true,
    channelId: 'UCSLrpBAzr-ROVGHQ5EmxnUg', organization: '코딩애플',
    tags: ['개발', '코딩', '개발 트렌드'], authority: 2, practicalValue: 3,
    dormancyDays: 90, maxItems: 10, allowEmpty: true,
  },
  {
    id: 'youtube-chase-ai', kind: 'youtube', enabled: true,
    channelId: 'UCoy6cTJ7Tg0dqS-DI-_REsA', organization: 'Chase AI',
    tags: ['AI', 'AI Agent', 'Claude Code', '자동화'], authority: 2, practicalValue: 3,
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
