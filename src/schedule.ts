export function localHour(date: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(date);
  return Number.parseInt(hour, 10);
}

export function isDeliveryTime(
  date: Date,
  timezone: string,
  startHour: number,
  endHour: number,
): boolean {
  const hour = localHour(date, timezone);
  return hour >= startHour && hour <= endHour;
}
