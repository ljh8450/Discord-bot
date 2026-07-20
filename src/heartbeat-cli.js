const { pingHeartbeat } = require('./monitoring/heartbeat');

function githubWarning(message) {
  const escaped = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  process.stdout.write(`::warning title=Opportunity Radar heartbeat::${escaped}\n`);
}

async function main() {
  try {
    const result = await pingHeartbeat({ url: process.env.RADAR_HEARTBEAT_URL });
    process.stdout.write(`${JSON.stringify({ heartbeat: result })}\n`);
  } catch (error) {
    if (process.env.GITHUB_ACTIONS === 'true') githubWarning(error.message);
    else process.stderr.write(`Heartbeat warning: ${error.message}\n`);
    process.stdout.write(`${JSON.stringify({ heartbeat: { status: 'WARNING', error: error.message } })}\n`);
  }
}

main();
