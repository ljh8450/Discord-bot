# Session log hook

```js
const { createSessionLogHook } = require('./src/hooks/session-log-hook');

const sessionLogs = createSessionLogHook();
const sessionId = sessionLogs.createSessionId();

await sessionLogs.onSessionStart(sessionId, { channelId: '123' });
await sessionLogs.onMessage(sessionId, {
  role: 'user',
  content: 'hello',
});
await sessionLogs.onSessionEnd(sessionId, { reason: 'completed' });
```

기본 저장 위치는 `logs/sessions/<sessionId>.jsonl`입니다. 프로세스를 종료하기
전에는 `await sessionLogs.flush()`를 호출하면 아직 진행 중인 파일 쓰기를 기다립니다.
`token`, `password`, `secret`, `authorization`, `cookie` 키의 값은 자동으로
`[REDACTED]` 처리됩니다.
