export function todayLocalKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function differenceInCalendarDays(fromKey: string, toKey: string): number {
  const from = dateFromKey(fromKey);
  const to = dateFromKey(toKey);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function addCalendarDays(key: string, amount: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return todayLocalKey(date);
}

export function formatDate(key: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(dateFromKey(key));
}

export function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
  }).format(dateFromKey(key));
}

export function formatMonthYear(key: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(dateFromKey(key));
}

export function keysBetween(startKey: string, endKey: string): string[] {
  const result: string[] = [];
  const totalDays = differenceInCalendarDays(startKey, endKey);
  const direction = totalDays >= 0 ? 1 : -1;
  for (let index = 0; index <= Math.abs(totalDays); index += 1) {
    result.push(addCalendarDays(startKey, index * direction));
  }
  return result;
}
