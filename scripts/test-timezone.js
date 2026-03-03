const { zonedDayBounds } = require('../apps/worker/dist/timezone.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const ref = new Date('2026-03-02T15:00:00.000Z');
  const pr = zonedDayBounds(ref, 'America/Puerto_Rico');
  const utc = zonedDayBounds(ref, 'UTC');

  assert(pr.start.toISOString().startsWith('2026-03-02T04:00:00'), 'PR start should be 04:00Z');
  assert(utc.start.toISOString().startsWith('2026-03-02T00:00:00'), 'UTC start should be 00:00Z');
  assert(pr.end > pr.start, 'PR bounds invalid');
  assert(utc.end > utc.start, 'UTC bounds invalid');

  console.log('PASS timezone helper');
}

run();
