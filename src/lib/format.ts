// Ported from the mobile app's utils/format-sale-schedule.ts and
// utils/parse-sale-form-input.ts (formatTimeOfDay) — same display rules,
// kept in sync by hand since the two projects don't share a package.

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatSaleDateRange(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (startDate === endDate) {
    if (isSameCalendarDay(start, new Date())) return 'Today';
    return `${WEEKDAY_LABELS[start.getDay()]}, ${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`;
  }

  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${WEEKDAY_LABELS[start.getDay()]}–${WEEKDAY_LABELS[end.getDay()]}, ${MONTH_LABELS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`;
  }

  return `${WEEKDAY_LABELS[start.getDay()]} ${MONTH_LABELS[start.getMonth()]} ${start.getDate()} – ${WEEKDAY_LABELS[end.getDay()]} ${MONTH_LABELS[end.getMonth()]} ${end.getDate()}`;
}

export function formatTimeOfDay(pgTime: string): string {
  const [hourStr, minuteStr] = pgTime.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const meridiem = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  return minute === 0 ? `${hour}${meridiem}` : `${hour}:${String(minute).padStart(2, '0')}${meridiem}`;
}

export function formatSaleSchedule(schedule: {
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
}): string {
  const dateLabel = formatSaleDateRange(schedule.startDate, schedule.endDate);
  return `${dateLabel} · ${formatTimeOfDay(schedule.dailyStartTime)}–${formatTimeOfDay(schedule.dailyEndTime)}`;
}

// Same fallback as the mobile app's deriveTitle — used when a seller never
// set a custom title. Works the same whether address_text is the real
// address or the view's already-fuzzed "Street Name area" string.
export function deriveTitle(addressText: string): string {
  const firstSegment = addressText.split(',')[0]?.trim() || addressText;
  const streetName = firstSegment.replace(/^\d+\s+/, '');
  return `${streetName} garage sale`;
}
