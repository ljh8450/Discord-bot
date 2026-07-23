async function main() {
  process.stdout.write(`${JSON.stringify({
    sent: false,
    disabled: true,
    reason: '채용공고는 최초 발견 시 레이더에서 한 번만 발송합니다.',
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
