/**
 * Rapel (arrears / back pay) calculation.
 *
 * Formula per user business rules:
 *   rapel = (newSalary - oldSalary) × overdueMonths
 *
 * overdueMonths is the whole-month gap between the TMT (effective date of
 * the increment) and today. If TMT is in the future (KGB processed on time
 * or early), overdueMonths is 0. If TMT is in the past but less than a
 * full month ago, overdueMonths is still 0 (no rapel yet).
 */

export function monthsOverdue(effectiveDate: Date, asOf: Date = new Date()): number {
  const years = asOf.getFullYear() - effectiveDate.getFullYear();
  const months = asOf.getMonth() - effectiveDate.getMonth();
  const days = asOf.getDate() - effectiveDate.getDate();
  let total = years * 12 + months;
  if (days < 0) total -= 1;
  return Math.max(0, total);
}

export function rapelAmount(
  oldSalary: number,
  newSalary: number,
  effectiveDate: Date,
  asOf: Date = new Date(),
): number {
  const delta = newSalary - oldSalary;
  if (delta <= 0) return 0;
  return delta * monthsOverdue(effectiveDate, asOf);
}

export function rapelBreakdown(
  oldSalary: number,
  newSalary: number,
  effectiveDate: Date,
  asOf: Date = new Date(),
) {
  const months = monthsOverdue(effectiveDate, asOf);
  const delta = Math.max(0, newSalary - oldSalary);
  return {
    months,
    delta,
    amount: delta * months,
  };
}
