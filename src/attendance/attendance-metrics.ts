const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5];

export function monthPeriod(month: number, year: number, now = new Date(), timeZone = 'UTC') {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const today = dateAtUtcMidnight(calendarDateInTimeZone(now, timeZone));
    const endExclusive = monthEnd <= today ? monthEnd : start > today ? start : new Date(today.getTime() + DAY_MS);
    return { start, endExclusive };
}

export function calendarDateInTimeZone(value: Date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: safeTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return value.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function dateAtUtcMidnight(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('A calendar date must use YYYY-MM-DD format');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('A calendar date must be valid');
  return date;
}

export function startOfDayInTimeZone(value: Date, timeZone = 'UTC') {
  return dateAtUtcMidnight(calendarDateInTimeZone(value, timeZone));
}

export function clockMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : 0;
}

export function minutesInTimeZone(value: Date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: safeTimeZone(timeZone), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hours * 60 + minutes;
}

export function workingWeekdays(workWeek?: string) {
  if (workWeek === 'Sunday – Thursday') return [0, 1, 2, 3, 4];
  if (workWeek === 'Monday – Saturday') return [1, 2, 3, 4, 5, 6];
  return DEFAULT_WORKING_WEEKDAYS;
}

export function workingDays(start: Date, endExclusive: Date, holidays: Date[] = [], weekdays = DEFAULT_WORKING_WEEKDAYS) {
  const holidayKeys = new Set(holidays.map(dateKey));
  let days = 0;
  for (const date = new Date(start); date < endExclusive; date.setUTCDate(date.getUTCDate() + 1)) {
    const weekday = date.getUTCDay();
    if (weekdays.includes(weekday) && !holidayKeys.has(dateKey(date))) days += 1;
  }
  return days;
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }

function safeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return timeZone;
  } catch {
    return 'UTC';
  }
}
