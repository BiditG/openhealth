import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { error: "Better Auth routes were replaced by Supabase Auth." },
    { status: 410 },
  );
}

export const POST = GET;
