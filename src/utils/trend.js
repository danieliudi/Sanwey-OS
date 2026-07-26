import { parseDateInput } from "./date";

export function monthBounds(date) {
  const d = new Date(date);
  return [
    new Date(d.getFullYear(), d.getMonth(), 1),
    new Date(d.getFullYear(), d.getMonth() + 1, 1),
  ];
}

export function within(date, start, end) {
  if (!date) return false;
  const d = parseDateInput(date);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d < end;
}

export function pctChange(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
