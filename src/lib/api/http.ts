import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

export function jsonError(
  status: number,
  error: string,
  extra: JsonRecord = {}
) {
  return NextResponse.json(
    {
      error,
      status,
      ...extra,
    },
    { status }
  );
}

export function jsonOk<T extends JsonRecord>(data: T, status = 200) {
  return NextResponse.json(
    {
      ...data,
      status,
    },
    { status }
  );
}
