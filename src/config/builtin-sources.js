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
    id: 'openai-news', kind: 'rss', enabled: true, url: 'https://openai.com/news/rss.xml',
    organization: 'OpenAI', tags: ['AI', '모델', '개발 도구'], maxItems: 30,
  },
  {
    id: 'github-blog', kind: 'rss', enabled: true, url: 'https://github.blog/feed/',
    organization: 'GitHub', tags: ['개발', 'GitHub', 'Copilot'], maxItems: 30,
  },
  {
    id: 'google-developers-blog', kind: 'rss', enabled: true,
    url: 'https://developers.googleblog.com/feeds/posts/default?alt=rss',
    organization: 'Google Developers', tags: ['개발', 'AI', 'Google'], maxItems: 30,
  },
];

module.exports = { AGGREGATOR_SOURCES, BRIEF_SOURCES, OPPORTUNITY_SOURCES };
