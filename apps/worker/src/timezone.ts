export function zonedDayBounds(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const toUtc = (hour: number, minute: number, second: number) => {
    const utcGuess = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
    const local = dtf.formatToParts(utcGuess);
    const ly = Number(local.find((p) => p.type === 'year')?.value);
    const lm = Number(local.find((p) => p.type === 'month')?.value);
    const ld = Number(local.find((p) => p.type === 'day')?.value);
    const lh = Number(local.find((p) => p.type === 'hour')?.value);
    const lmin = Number(local.find((p) => p.type === 'minute')?.value);
    const ls = Number(local.find((p) => p.type === 'second')?.value);

    const targetMs = Date.UTC(y, m - 1, d, hour, minute, second);
    const localMs = Date.UTC(ly, lm - 1, ld, lh, lmin, ls);
    return new Date(utcGuess.getTime() - (localMs - targetMs));
  };

  const start = toUtc(0, 0, 0);
  const end = new Date(toUtc(23, 59, 59).getTime() + 999);
  return { start, end };
}
