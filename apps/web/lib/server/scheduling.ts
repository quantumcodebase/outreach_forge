import 'server-only';

function hhmmssFromDate(d: Date) {
  return d.toISOString().slice(11, 19);
}

function buildWindowDate(base: Date, hhmmss: string) {
  const [h, m, s] = hhmmss.split(':').map(Number);
  const out = new Date(base);
  out.setUTCHours(h || 0, m || 0, s || 0, 0);
  return out;
}

function jitterMs(minMinutes = 1, maxMinutes = 10) {
  const min = minMinutes * 60 * 1000;
  const max = maxMinutes * 60 * 1000;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function computeNextSendAt(now: Date, delayDays: number, windowStart: Date, windowEnd: Date) {
  const base = new Date(now.getTime() + Math.max(0, delayDays) * 24 * 60 * 60 * 1000);
  const start = buildWindowDate(base, hhmmssFromDate(windowStart));
  const end = buildWindowDate(base, hhmmssFromDate(windowEnd));

  let scheduled: Date;
  if (base < start) scheduled = start;
  else if (base > end) scheduled = buildWindowDate(new Date(base.getTime() + 24 * 60 * 60 * 1000), hhmmssFromDate(windowStart));
  else scheduled = new Date(base);

  return new Date(scheduled.getTime() + jitterMs());
}
