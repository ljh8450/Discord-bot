# Codex session transcript mirroring

This workspace mirrors Codex's native session transcript into:

```text
logs/codex-sessions/<session-id>.jsonl
```

The project-local hook runs when a Codex session starts or resumes, when a user
submits a prompt, and when a turn stops. Each run refreshes the workspace copy
from the native `transcript_path` supplied by Codex.

## Enable the hook

1. Open this repository as a trusted Codex project.
2. Run `/hooks` in Codex.
3. Review and trust the hooks from `.codex/hooks.json`.
4. Start a new chat or resume the current chat.
5. Send a message, then check `logs/codex-sessions/`.

Codex skips new or changed command hooks until their exact definitions are
reviewed and trusted.

## Privacy

Mirrored transcripts can contain prompts, assistant responses, local file
contents, commands, and tool output. The output directory is ignored by Git.
Do not remove that ignore rule or publish transcript files without reviewing
and redacting them.

Codex documents `transcript_path` as a convenient hook input, but the internal
transcript format is not a stable interface. Keep the raw mirror unchanged and
perform any analytics through a separate, version-tolerant parser.
