/**
 * @fileoverview Domain models shared across the application.
 * @module types/models
 */

/* ------------------------------------------------------------------ */
/*  AUTH & USERS                                                      */
/* ------------------------------------------------------------------ */

export type UserRole = 'client' | 'agent' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  loyalty_points: number;
  agent_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  FLIGHTS                                                           */
/* ------------------------------------------------------------------ */

export interface Airline {
  id: string;
  iata_code: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

export interface Airport {
  id: string;
  iata_code: string;
  name: string;
  city: string;
  country: string;
  timezone: string | null;
}

export interface Flight {
  id: string;
  airline_id: string;
  flight_number: string;
  origin_airport_id: string;
  destination_airport_id: string;
  departure_datetime: string;
  arrival_datetime: string;
  base_price: number;
  markup_percentage: number;
  final_price: number;
  total_seats: number;
  available_seats: number;
  aircraft_type: string | null;
  is_exclusive_offer: boolean;
  offer_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Flight joined with airline + airport names for display. */
export interface FlightWithDetails extends Flight {
  airline: Airline;
  origin_airport: Airport;
  destination_airport: Airport;
}

/* ------------------------------------------------------------------ */
/*  BOOKINGS                                                          */
/* ------------------------------------------------------------------ */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type BookingStatus = 'pending_emission' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  booking_code: string;
  user_id: string | null;
  flight_id: string | null;
  assigned_agent_id: string | null;
  subtotal: number;
  payment_gateway_fee: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_intent_id: string | null;
  paid_at: string | null;
  booking_status: BookingStatus;
  airline_pnr: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingPassenger {
  id: string;
  booking_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  passport_expiry_date: string;
  ticket_number: string | null;
}

/* ------------------------------------------------------------------ */
/*  CAR RENTALS                                                       */
/* ------------------------------------------------------------------ */

export type CarCategory = 'economy' | 'compact' | 'suv';

export interface CarRental {
  id: string;
  brand: string;
  model: string;
  category: CarCategory;
  transmission: 'manual' | 'automatic';
  passenger_capacity: number;
  luggage_capacity: number;
  daily_rate: number;
  available_units: number;
  image_url: string | null;
  features: string[];
  is_active: boolean;
}

/* ------------------------------------------------------------------ */
/*  REVIEWS                                                           */
/* ------------------------------------------------------------------ */

export type ReviewStatus = 'pending_approval' | 'approved' | 'rejected';

export interface Review {
  id: string;
  user_id: string;
  booking_id: string;
  rating: number;
  title: string | null;
  comment: string;
  photo_urls: string[];
  status: ReviewStatus;
  created_at: string;
}

export interface ReviewWithAuthor extends Review {
  profile: Pick<Profile, 'full_name' | 'avatar_url'>;
}

/* ------------------------------------------------------------------ */
/*  AGENT NEWS                                                        */
/* ------------------------------------------------------------------ */

export interface AgentNews {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  category: 'update' | 'promo' | 'alert' | null;
  attachment_url: string | null;
  is_pinned: boolean;
  created_at: string;
}
