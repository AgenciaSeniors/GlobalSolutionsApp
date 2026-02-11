import type { FlightSearchRequest } from "@/types/flights-search.types";

const req: FlightSearchRequest = {
  legs: [
    { origin: "EZE", destination: "MAD", departure_date: "2026-03-10" },
    { origin: "MAD", destination: "BCN", departure_date: "2026-03-15" },
  ],
  passengers: { adults: 1, children: 1 },
  filters: { maxStops: 1, airlineCodes: ["IB"] },
};

console.log(req);
