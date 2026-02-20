"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  photo_urls: string[] | null;
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
  nextCursor: string | null;
};

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-1" aria-label={`${full} estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? "opacity-100" : "opacity-30"}>
          ★
        </span>
      ))}
    </div>
  );
}

async function fetchReviews(limit: number, cursor: string | null): Promise<ReviewsResponse> {
  const url = new URL("/api/reviews", window.location.origin);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Error cargando reseñas");
  }
  return (await res.json()) as ReviewsResponse;
}

export default function ReviewsFeed() {
  const LIMIT = 24;

  const [items, setItems] = useState<ReviewRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canLoadMore = useMemo(() => !!nextCursor && !loading, [nextCursor, loading]);

  async function load(cursor: string | null) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviews(LIMIT, cursor);
      setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }

  useEffect(() => {
    void load(null);
  }, []);

  if (firstLoad && loading) {
    return <p className="text-sm opacity-80">Cargando reseñas…</p>;
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-2xl border p-6">
        <p className="text-sm">No se pudieron cargar las reseñas.</p>
        <p className="mt-2 text-xs opacity-70">{error}</p>
        <button className="mt-4 underline" onClick={() => load(null)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => {
          const destination =
            r.booking?.flight?.destination_airport?.city ||
            r.booking?.offer?.destination ||
            null;

          return (
            <article key={r.id} className="rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.profile?.full_name ?? "Cliente"}</p>
                  <p className="text-xs opacity-70">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>

              {r.title ? <h3 className="mt-3 font-semibold">{r.title}</h3> : null}
              {r.comment ? (
                <p className="mt-2 text-sm leading-relaxed opacity-90">{r.comment}</p>
              ) : null}

              {destination ? (
                <p className="mt-4 text-xs opacity-70">
                  Destino: <span className="font-medium">{destination}</span>
                </p>
              ) : null}

              {Array.isArray(r.photo_urls) && r.photo_urls.length > 0 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto">
                  {r.photo_urls.slice(0, 4).map((url, idx) => (
                    <Image
                    key={idx}
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    width={64}
                    height={64}
                    className="rounded-xl object-cover border"
                    sizes="64px"
                    />
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <div className="mt-8 flex items-center justify-center">
        {nextCursor ? (
          <button
            onClick={() => load(nextCursor)}
            disabled={!canLoadMore}
            className="rounded-xl border px-4 py-2 shadow-sm disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        ) : (
          <p className="text-sm opacity-70">No hay más reseñas.</p>
        )}
      </div>

      {error && items.length > 0 ? (
        <p className="mt-4 text-center text-xs opacity-70">{error}</p>
      ) : null}
    </>
  );
}