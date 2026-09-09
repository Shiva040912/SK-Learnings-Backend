export const MIN_FEE_DUE_DAY = 1;
export const MAX_FEE_DUE_DAY = 31;

export function isValidFeeDueDay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_FEE_DUE_DAY &&
    value <= MAX_FEE_DUE_DAY
  );
}

/*
 * Returns the given day-of-month for (year, monthIndex), clamped to that
 * month's last real day. This is how "Due Day 31" resolves to Feb 28/29,
 * Apr 30, etc. instead of producing an invalid or rolled-over date.
 */
export function getMonthDayDate(
  year: number,
  monthIndex: number,
  day: number,
): Date {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(Math.trunc(day) || 1, 1), lastDayOfMonth);

  const date = new Date(year, monthIndex, safeDay);
  date.setHours(0, 0, 0, 0);

  return date;
}

/*
 * The recurring monthly Due Day is config, not a date — this computes the
 * actual due date for the CURRENT unpaid cycle: the first occurrence of
 * `feeDueDay` on or after `anchorDate` (the date the fee/cycle started).
 *
 * This is computed ONCE, when a fee cycle begins (fee setup, fee edit, or a
 * new cycle via Assign Next Fee) — it is never advanced forward by a
 * background job while a balance is still pending. Since the pending
 * balance itself never resets either, once `today` passes this date the
 * comparison stays true every day after that (including into later
 * months) — which is exactly what "stays overdue continuously until paid"
 * requires, with no separate month-by-month recompute step needed.
 */
export function computeFeeDueDate(feeDueDay: number, anchorDate: Date): Date {
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);

  const candidate = getMonthDayDate(
    anchor.getFullYear(),
    anchor.getMonth(),
    feeDueDay,
  );

  if (candidate < anchor) {
    return getMonthDayDate(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      feeDueDay,
    );
  }

  return candidate;
}
