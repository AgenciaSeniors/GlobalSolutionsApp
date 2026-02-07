/**
 * @fileoverview Domain models — ALL types for Global Solutions Travel.
 * Matches schema v1 + v2 (002_extended_schema.sql).
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
  return_date: string | null;
  emitted_at: string | null;
  emitted_by: string | null;
  review_requested: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingWithDetails extends Booking {
  profile?: Pick<Profile, 'full_name' | 'email'>;
  flight?: FlightWithDetails;
  passengers?: BookingPassenger[];
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
/*  PRICE BREAKDOWN (§5.1 Transparency)                               */
/* ------------------------------------------------------------------ */

export interface PriceBreakdown {
  base_price: number;
  markup_amount: number;
  subtotal: number;
  gateway_fee: number;
  gateway_fee_pct: number;
  gateway_fixed_fee: number;
  total: number;
  passengers: number;
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

export interface CarRentalBooking {
  id: string;
  user_id: string;
  car_rental_id: string;
  pickup_date: string;
  return_date: string;
  pickup_location: string;
  return_location: string;
  total_days: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  SPECIAL OFFERS (§3.2 Visual Engine)                               */
/* ------------------------------------------------------------------ */

export interface SpecialOffer {
  id: string;
  destination: string;
  destination_img: string | null;
  origin_airport_id: string | null;
  destination_airport_id: string | null;
  airline_id: string | null;
  flight_number: string | null;
  valid_dates: string[];
  original_price: number;
  offer_price: number;
  markup_percentage: number;
  tags: string[];
  urgency_label: string | null;
  max_seats: number;
  sold_seats: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  QUOTATION REQUESTS (§3.3)                                         */
/* ------------------------------------------------------------------ */

export type QuotationStatus = 'pending' | 'quoted' | 'accepted' | 'expired' | 'cancelled';

export interface QuotationRequest {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string;
  guest_phone: string | null;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  passengers: number;
  trip_type: 'oneway' | 'roundtrip' | 'multicity';
  flexible_dates: boolean;
  notes: string | null;
  status: QuotationStatus;
  quoted_price: number | null;
  quoted_by: string | null;
  quoted_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  REVIEWS (§7.2 Verified Reviews)                                   */
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
/*  AGENT NEWS (§2.2 Community Wall)                                  */
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

/* ------------------------------------------------------------------ */
/*  AGENT TICKETS (§2.2 Internal Comm)                                */
/* ------------------------------------------------------------------ */

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';
export type TicketCategory = 'general' | 'booking_issue' | 'payment' | 'technical' | 'complaint' | 'suggestion';

export interface AgentTicket {
  id: string;
  ticket_code: string;
  created_by: string;
  assigned_to: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface AgentTicketWithDetails extends AgentTicket {
  creator?: Pick<Profile, 'full_name' | 'email' | 'role'>;
  assignee?: Pick<Profile, 'full_name' | 'email' | 'role'>;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  is_internal: boolean;
  created_at: string;
  sender?: Pick<Profile, 'full_name' | 'role'>;
}

/* ------------------------------------------------------------------ */
/*  LOYALTY (§7.2 Points)                                             */
/* ------------------------------------------------------------------ */

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  reference_type: 'review' | 'booking' | 'promo' | 'redemption' | null;
  reference_id: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  CHAT SYSTEM (§7.1 Chatbot IA + Human)                             */
/* ------------------------------------------------------------------ */

export type ChatStatus = 'bot' | 'waiting_agent' | 'with_agent' | 'resolved' | 'closed';
export type ChatSenderType = 'user' | 'bot' | 'agent';

export interface ChatConversation {
  id: string;
  user_id: string;
  assigned_agent_id: string | null;
  status: ChatStatus;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: ChatSenderType;
  sender_id: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  OTP AUTH (§2 Hybrid Auth)                                         */
/* ------------------------------------------------------------------ */

export type OTPStep = 'email' | 'verify' | 'password';

export interface RegisterState {
  step: OTPStep;
  email: string;
  otp: string;
  full_name: string;
  phone: string;
  password: string;
  confirm_password: string;
}
