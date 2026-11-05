// Display helpers for times stored as UTC epoch milliseconds. Sri Lanka is Asia/Colombo, a fixed
// UTC+05:30 with no daylight saving, so the shift is done by hand and does not depend on the
// runtime's time zone data.

const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 1_793_836_800_000 (2026-11-05T00:00Z) -> "5 Nov 2026". */
export function formatColomboDate(instant: number): string {
  const d = new Date(instant + COLOMBO_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 1_793_836_800_000 -> "5 Nov 2026, 5:30 am". Twelve-hour clock, lower-case am or pm. */
export function formatColomboDateTime(instant: number): string {
  const d = new Date(instant + COLOMBO_OFFSET_MS);
  const hours = d.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatColomboDate(instant)}, ${hour12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}

/** How long ago, for a queue: "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAge(instant: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - instant) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
