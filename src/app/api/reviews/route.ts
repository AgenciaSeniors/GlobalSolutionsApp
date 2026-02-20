// src/app/api/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReviewRow = {
  id: string;
  profile_id: string;
  booking_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  photo_urls: string[] | null;
  status: string;
  created_at: string;

  profile?: { full_name: string | null; avatar_url: string | null } | null;

  booking?: {
    booking_code: string | null;
    flight?: { destination_airport?: { city: string | null } | null } | null;
    offer?: { destination: string | null } | null;
  } | null;
};

type ReviewsResponse = {
  items: ReviewRow[];
  nextCursor: string | null; // "created_at|id"
};

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 24;
  return Math.max(1, Math.min(60, Math.floor(n)));
}

function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  const parts = cursor.split("|");
  if (parts.length !== 2) return null;
  const [createdAt, id] = parts;
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

export async function GET(req: NextRequest) {
  try {
    // Safety: si la key no está, mejor decirlo claro
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY no está configurada. Agrega la variable en .env.local y reinicia el servidor.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get("limit"));
    const cursorRaw = searchParams.get("cursor");
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

    let query = supabaseAdmin
      .from("reviews")
      .select(
        `
        id, profile_id, booking_id, rating, title, comment, photo_urls, status, created_at,
        profile:profiles!reviews_user_id_fkey(full_name, avatar_url),
        booking:bookings!reviews_booking_id_fkey(
          booking_code,
          flight:flights!bookings_flight_id_fkey(
            destination_airport:airports!flights_destination_airport_id_fkey(city)
          ),
          offer:special_offers!bookings_offer_id_fkey(destination)
        )
      `
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    // Cursor pagination:
    // (created_at < cursorCreatedAt) OR (created_at = cursorCreatedAt AND id < cursorId)
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[/api/reviews] supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as ReviewRow[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor(items[items.length - 1].created_at, items[items.length - 1].id)
        : null;

    const res: ReviewsResponse = { items, nextCursor };
    return NextResponse.json(res);
  } catch (err: unknown) {
    console.error("[/api/reviews] unexpected:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}