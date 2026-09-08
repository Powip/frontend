import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: process.env.NEXT_PUBLIC_APP_NAME ?? "frontend",
    environment: process.env.NEXT_PUBLIC_RUNTIME_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
}
