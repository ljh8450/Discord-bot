# Developer Opportunity Radar

수도권 신입 개발자가 놓치기 쉬운 채용·해커톤·교육·대외활동을 먼저 찾아 Discord로 알려주고, AI 시대의 개발 변화를 하루 한 번 읽기 좋게 묶어주는 자동화 레이더입니다.

단순히 링크를 많이 모으는 대신 **지금 확인하고 행동할 가치가 있는 새로운 기회와 변화만 알리는 것**을 목표로 합니다. 여러 채용 사이트와 기술 블로그, 커뮤니티, YouTube를 직접 순회하는 시간을 줄이고 실제 지원과 학습에 집중할 수 있게 합니다.

## 이 프로젝트가 해결하는 것

- **공고를 남보다 일찍 발견합니다.** 짧은 주기의 수집과 일일 복구 작업으로 신규 공고와 놓친 항목을 다시 확인합니다.
- **지원할 수 있는 것만 남깁니다.** 신입·인턴, 수도권·원격, 개발 직무와 실제 개발 결과물 여부를 근거로 필터링합니다.
- **같은 알림을 반복하지 않습니다.** URL·제목·마감일·내용 해시와 전송 상태를 함께 관리합니다.
- **한 기회는 한 번만 알립니다.** 최초 성공 발송 뒤에는 내용이나 마감일이 바뀌어도 다시 알리지 않습니다.
- **개발 트렌드는 하루 한 번만 받습니다.** 공식 뉴스, 국내 기술 블로그, GeekNews 인기글, 선별된 YouTube 영상을 하나의 Brief로 묶습니다.
- **한 출처가 고장 나도 계속 동작합니다.** 출처별 실패 격리, 일시 오류 재시도, 운영 경고와 heartbeat를 지원합니다.

## 주요 기능

- 네이버·카카오·쿠팡·사람인 등 개발자 채용 수집
- 링커리어·캠퍼스픽·DACON·GDG·프로그래머스 등 개발 기회 수집
- OpenAI·Anthropic·GitHub·Google Developers 공식 업데이트 기반 일일 개발 브리프
- GeekNews 인기글과 NAVER D2·카카오·토스·당근·우아한형제들·LINE/LY 기술 아티클 수집
- 실밸개발자·AI Frontier Korea·Tech Bridge·미드나잇 로그·조코딩·AgentOS·코딩하는 기술사·코딩애플 YouTube 수집
- EO Korea·안될공학에서 AI·개발 관련 영상만 선택 수집
- 관련성·실용성·신선도·권위·새로움·커뮤니티 반응 기반 콘텐츠 점수
- 신입·인턴, 수도권·원격, 선호 개발 직무 기준 필터링
- 원문 URL, 모집 상태, 마감일, 지원 자격, 요약 근거 검증
- URL·제목·마감일 기반 출처 간 중복 제거
- 신규 발견 알림만 발송
- 채용·해커톤·대외활동·교육·개발 인사이트별 Discord 채널 라우팅
- 전송 실패 재시도, 출처 장애 경고, heartbeat 모니터링
- GitHub Models를 이용한 한국어 한 줄 요약과 실패 시 원문 요약 폴백

## Developer Brief

기회 알림의 집중도를 해치지 않도록 개발 콘텐츠는 실시간으로 쏟아내지 않고 정해진 시간에 한 번에 전달합니다. 최근 콘텐츠를 점수화한 뒤 최신순이 아닌 **읽을 가치가 높은 순서**로 최대 6개를 고릅니다.

| 종류 | 수집 출처 |
|---|---|
| 글로벌 공식 업데이트 | OpenAI News, Anthropic Newsroom, GitHub Blog, Google Developers Blog |
| 국내 현업 기술 사례 | NAVER D2, Kakao Tech, 토스, 당근, 우아한형제들, LINE·LY 기술 블로그 |
| 커뮤니티 인기글 | GeekNews 상위 20위 중 추천 5점 이상 |
| 핵심 YouTube | 실밸개발자, AI Frontier Korea, Tech Bridge, 미드나잇 로그, 조코딩, AgentOS, 코딩하는 기술사, 코딩애플 |
| 선택 YouTube | EO Korea와 안될공학의 AI·개발 관련 영상 |

YouTube는 공식 Atom 피드를 사용해 API 키 없이 수집합니다. Shorts는 제외하며 최근 90일 동안 일반 영상이 없으면 채널을 휴면 처리합니다. 이후 새 영상이 올라오면 다음 실행에서 자동으로 다시 활성화됩니다. 같은 글이나 영상이 여러 출처에 등장하면 URL과 제목으로 합치고, 한 출처에서 최대 2개만 뽑아 Brief가 특정 채널에 편중되지 않게 합니다.

## 동작 구조

```text
Cloudflare / GitHub Scheduler
  -> HTML / JSON / RSS / Atom / YouTube Adapters
  -> Opportunity 정규화
  -> 출처 간 중복 제거
  -> 최소 신뢰성 검증
  -> 사용자 프로필 필터
  -> 이전 상태와 비교
  -> 신규 여부와 상태 변경 감지
  -> 카테고리별 Discord 전송
  -> 전송 결과와 최신 상태 저장
```

각 출처의 HTML·JSON·RSS 응답은 Adapter가 공통 `Opportunity` 모델로 변환합니다. 정규화 과정에서 추적용 URL 파라미터를 제거하고 안정적인 내부 ID와 `contentHash`를 생성합니다.

이전 실행 상태와 비교해 다음 이벤트를 판별합니다.

- `DISCOVERED`: 처음 발견한 기회
- `UPDATED`: 제목·마감일·자격 등 중요 정보 변경을 상태에 기록하되 재알림하지 않음
- `CLOSED`: 공식 출처에서 연속으로 확인되지 않은 기회

각 이벤트는 고유한 `dedupeKey`와 전송 상태를 저장합니다. 스케줄러가 중복 실행돼도 이미 성공한 메시지는 다시 보내지 않으며, 실패한 전송은 다음 실행에서 재시도합니다.

## 선별 기준

현재 기본 프로필은 다음 조건에 초점을 맞춥니다.

- 대상: 신입·인턴·경력 무관
- 지역: 서울·경기·인천·원격
- 직무: 백엔드·풀스택·프론트엔드·FDE·AI Engineer
- 해커톤·공모전: 실제 소프트웨어 개발 결과물 근거 필수
- 링커리어·캠퍼스픽 대외활동: 코드·MVP·프로덕트·서비스·배포 등 명시적 개발 결과물 근거 필수
- 교육·대외활동: 비용, 기간, 멘토링, 포트폴리오, 채용 연계 등 혜택 심사

설정은 [`config/profile.json`](config/profile.json)과 [`config/sources.json`](config/sources.json)에서 변경할 수 있습니다.

## 자동화와 안정성

GitHub Actions가 실제 수집·검증·전송을 실행하고, Cloudflare Worker는 GitHub workflow를 호출하는 독립 보조 스케줄러로 동작합니다.

- 다중 스케줄러 기반의 짧은 주기 기회 수집
- 일일 채용 목록 및 개발 인사이트 브리프
- 일일 복구 작업으로 최근 미전송 항목 재처리
- workflow 동시 실행 제한
- 실행당 전체 및 카테고리별 알림 상한
- 429·5xx 재시도와 출처별 부분 실패 격리
- 출처 오류·0건 급감·Discord 전송 실패 운영 경고
- 성공 실행 heartbeat
- 상태 파일 변경 시 자동 커밋 및 충돌 재시도

## 실행 방법

Node.js 20 이상이 필요하며 외부 패키지 의존성은 없습니다.

```bash
npm test
npm run dry-run
npm run radar
```

기타 명령은 다음과 같습니다.

```bash
npm run recover        # 최근 미전송 기회 복구
npm run digest         # 현재 유효한 채용 목록 전송
npm run brief          # 일일 개발 인사이트 전송
npm run brief-dry-run  # 브리프 후보만 확인
npm run heartbeat      # 스케줄러 heartbeat 전송
```

환경 변수는 [`.env.example`](.env.example)을 참고하세요. 실제 토큰과 Discord Webhook URL은 저장소에 커밋하지 말고 로컬 `.env` 또는 GitHub Actions Secrets에 저장해야 합니다.

## 현재 구현 상태

현재 버전은 개인 또는 소규모 Discord 서버에서 실제 운영 가능한 MVP입니다. 기회 수집, 콘텐츠 브리프, Discord 라우팅, 상태 체크포인트, 복구 작업과 운영 모니터링까지 자동 테스트로 검증합니다.

## 향후 범위

- 사용자별 구독 조건과 Discord 슬래시 명령
- 관심·지원·관련 없음 피드백 저장 API
- JSON/Git 상태 저장을 D1 등 운영 데이터베이스로 이전
- 관리자 대시보드와 전환율 분석
- 사용자별 추천 및 알림 빈도 설정

## 주요 파일

- [`src/pipeline/run-radar.js`](src/pipeline/run-radar.js): 변화 감지와 전송 파이프라인
- [`src/pipeline/run-brief.js`](src/pipeline/run-brief.js): 개발 콘텐츠 점수화와 일일 큐레이션
- [`src/adapters`](src/adapters): 출처별 수집 Adapter
- [`src/domain`](src/domain): 정규화·검증·필터·중복 제거
- [`src/discord`](src/discord): Discord 메시지와 채널 라우팅
- [`cloudflare/radar-scheduler.mjs`](cloudflare/radar-scheduler.mjs): Cloudflare 보조 스케줄러
- [`.github/workflows`](.github/workflows): 수집·브리프·복구 자동화
- [`data/state.json`](data/state.json): 기회와 전송 상태
- [`docs/PRODUCT_DEFINITION.md`](docs/PRODUCT_DEFINITION.md): 제품 정의
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md): 상세 구현 가이드
