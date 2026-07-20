# Opportunity Radar 구현 가이드

현재 구현은 solution.md의 P0 파이프라인을 실행 가능한 형태로 시작한 버전이다.

## 포함된 범위

- 서버 공통 프로필과 allowlist
- JOB, HACKATHON, EDUCATION 정규화
- URL 추적 파라미터 제거와 안정적인 중복 키
- 채용·해커톤·교육 규칙 필터
- 원문 근거가 있는 한 줄 요약 최소 검증
- 조건부 교육의 PENDING_BENEFIT 2단계 심사
- JSON 파일 상태와 Discord 전송 재시도
- 컴팩트한 Discord embed와 링크형 행동 버튼
- 30분 수집 및 일일 복구 GitHub Actions
- NAVER, NAVER Cloud, NAVER Z, 카카오 테크 공식 채용 출처
- 실제 발송 없이 후보를 확인하는 npm run dry-run
- 현재 유효 공고를 한 줄씩 묶어 보내는 npm run digest
- 중요 필드 변경의 UPDATED 이벤트와 발송 직후 상태 체크포인트
- JOB, HACKATHON, CONTENT, EXTERNAL_ACTIVITY, EDUCATION 채널 라우터
- D-3, D-1, 당일 마감 알림과 이벤트별 중복 방지
- 출처 오류·0건 급감·Discord 발송 실패의 운영 채널 경고
- 수집 결과가 갑자기 0건일 때 기존 공고 종료 판정을 보류하는 안전장치
- 실행당 기본 10건 발송 상한과 다음 실행 자동 이월

## 로컬 실행

Node.js 20 이상만 필요하며 외부 패키지 의존성은 없다.

1. npm test
2. 저장소 루트의 .env에 DISCORD_OPPORTUNITIES_WEBHOOK_URL을 설정한다.
3. npm run radar

config/sources.json의 예제 출처는 실수로 테스트 데이터를 전송하지 않도록 기본
비활성화되어 있다. 로컬 end-to-end 확인 시 local-example.enabled를 true로 바꾸면
fixtures/opportunities.json을 수집한다.

## JSON 출처 설정

정식 API나 안정적인 JSON endpoint가 있는 출처는 config/sources.json의 map에서
외부 필드 경로를 공통 모델 필드에 연결한다. 출처별 응답이 공통 모델과 크게 다르면
src/adapters에 전용 어댑터를 추가한다. 어댑터는 수집만 담당하고 Discord를 직접
호출하지 않는다.

## GitHub 설정

- Actions secret: DISCORD_OPPORTUNITIES_WEBHOOK_URL
- 선택적 Actions variable: FEEDBACK_BASE_URL
- 선택적 Actions secret: DISCORD_OPERATIONS_WEBHOOK_URL
- 선택적 Actions variable: RADAR_MAX_NOTIFICATIONS_PER_RUN
- workflow permission: 저장소의 Actions 설정에서 read/write 허용

상태는 data/state.json으로 생성되고 Actions가 저장소에 커밋한다. 두 workflow는 같은
concurrency group을 사용하므로 동시에 상태를 갱신하지 않는다.

로컬 CLI는 .env를 자동으로 읽는다. 이미 설정된 시스템 환경 변수는 .env보다 우선한다.
GitHub Actions에서는 .env를 사용하지 않고 repository secret을 사용한다.

## 운영 중인 출처

- NAVER Careers
- NAVER Cloud Careers
- NAVER Z Careers
- 카카오 테크 채용 공개 API

dry-run은 실제 상태 파일의 복사본을 사용하므로 이미 발송된 항목을 제외하고 새 항목과
중요 변경 후보만 출력한다. 실제 상태 파일은 수정하지 않는다.

## 아직 남은 P0

- 해커톤·교육 공식 출처 어댑터
- 행동 링크를 받아 feedback에 기록하는 서버리스 endpoint
- 운영 지표 집계

행동 버튼은 현재 FEEDBACK_BASE_URL이 있을 때만 표시된다. 이 URL은 opportunityId와
action=interested|applied|irrelevant query를 받는 endpoint여야 한다. 수신 endpoint가
없는 상태에서는 공고 보기 버튼만 표시한다.
