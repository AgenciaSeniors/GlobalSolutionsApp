/**
 * Passenger business rules derived from Date of Birth (DOB).
 * 
 * Module 2 Pricing Matrix (Age-based pricing):
 * - Infant (0–2 years): 10% of base fare
 * - Child (2–12 years): 75% of base fare  
 * - Adult (>12 years): 100% of base fare
 * 
 * Note: Age boundaries are inclusive/exclusive as specified:
 * - 0-2 years = Infant (strictly less than 2 years)
 * - 2-12 years = Child (2 or more, less than 12)
 * - 12+ years = Adult
 */

export type PassengerType = "infant" | "child" | "adult";

/**
 * Age multipliers for pricing calculations
 * Based on Module 2 Financial Infrastructure spec
 */
export const AGE_MULTIPLIERS: Readonly<Record<PassengerType, number>> = {
  infant: 0.10, // 10% for 0-2 years
  child: 0.75,  // 75% for 2-12 years
  adult: 1.00,  // 100% for 12+ years
} as const;

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
 * Classification rules:
 * - Infant: age < 2 years (0-1 years old)
 * - Child: 2 <= age < 12 years (2-11 years old)
 * - Adult: age >= 12 years
 * 
 * Secure fallback:
 * - If DOB is invalid, treat as "adult" to avoid undercharging.
 * 
 * @param dobIso - Date of birth in YYYY-MM-DD format
 * @param now - Optional reference date (defaults to current date)
 * @returns PassengerType classification
 */
export function passengerTypeFromDobIso(dobIso: string, now = new Date()): PassengerType {
  const dob = parseIsoDateOnly(dobIso);
  if (!dob) return "adult"; // Secure fallback
  
  const years = calcAgeYears(dob, now);
  
  if (years < 2) {
    return "infant";
  } else if (years < 12) {
    return "child";
  } else {
    return "adult";
  }
}

/**
 * Get the price multiplier for a passenger based on their DOB
 * 
 * @param dobIso - Date of birth in YYYY-MM-DD format
 * @param now - Optional reference date (defaults to current date)
 * @returns Price multiplier (0.10 for infant, 0.75 for child, 1.00 for adult)
 */
export function getPassengerMultiplier(dobIso: string, now = new Date()): number {
  const type = passengerTypeFromDobIso(dobIso, now);
  return AGE_MULTIPLIERS[type];
}

/**
 * Count passengers by type from an array of DOB strings
 * 
 * @param dobIsoList - Array of dates of birth in YYYY-MM-DD format
 * @param now - Optional reference date (defaults to current date)
 * @returns Object with counts for each passenger type
 */
export function countPassengersByType(
  dobIsoList: string[], 
  now = new Date()
): { infant: number; child: number; adult: number; total: number } {
  const counts = { infant: 0, child: 0, adult: 0, total: 0 };
  
  for (const dobIso of dobIsoList) {
    const type = passengerTypeFromDobIso(dobIso, now);
    counts[type]++;
    counts.total++;
  }
  
  return counts;
}
