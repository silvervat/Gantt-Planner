export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function addDays(base: string, n: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getIsoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
}

export function getMonthLabelEt(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const kuud = ["JAANUAR", "VEEBRUAR", "MÄRTS", "APRILL", "MAI", "JUUNI", "JUULI", "AUGUST", "SEPTEMBER", "OKTOOBER", "NOVEMBER", "DETSEMBER"];
  return kuud[d.getMonth()] + " " + d.getFullYear();
}

export function getWeekdayEtShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const map = ["P", "E", "T", "K", "N", "R", "L"];
  return map[d.getDay()];
}

export function sameMonthYear(a: string, b: string): boolean {
  const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00");
  return da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
}

export function sameIsoWeek(a: string, b: string): boolean {
  return getIsoWeek(a) === getIsoWeek(b);
}
