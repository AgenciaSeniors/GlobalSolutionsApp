/**
 * Passenger business rules derived from Date of Birth (DOB).
 *
 * Current Module 2 pricing rule set:
 * - Infant (0–2 years inclusive): 50% of base fare
 * - Adult (>2 years): 100% of base fare
 */

export type PassengerType = "infant" | "adult";

function parseIsoDateOnly(dobIso: string): Date | null {
  // Expecting "YYYY-MM-DD" (Supabase `date` typically serializes like this)
  // We append a safe time to avoid timezone shifts.
  const normalized = `${dobIso}T00:00:00Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calcAgeYears(dob: Date, now: Date): number {
  let years = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    years -= 1;
  }
  return years;
}

/**
 * Converts a DOB ISO string (YYYY-MM-DD) into a passenger type.
 *
 * Secure fallback:
 * - If DOB is invalid, treat as "adult" to avoid undercharging.
 */
export function passengerTypeFromDobIso(dobIso: string, now = new Date()): PassengerType {
  const dob = parseIsoDateOnly(dobIso);
  if (!dob) return "adult";
  const years = calcAgeYears(dob, now);
  return years <= 2 ? "infant" : "adult";
}
