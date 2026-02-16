export type Sex = "M" | "F" | "X";

export interface PassengerRecord {
  id: string;
  booking_id: string;

  first_name: string;
  last_name: string;

  sex: Sex;
  nationality: string; // ideal ISO-3166-1 alpha-2

  date_of_birth: string; // "YYYY-MM-DD"

  passport_number: string;
  passport_issue_date: string;  // "YYYY-MM-DD"
  passport_expiry_date: string; // "YYYY-MM-DD"

  phone: string | null;

  created_at: string;
  updated_at: string;
}
