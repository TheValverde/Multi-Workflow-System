import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKeyLength: process.env.SUPABASE_ANON_KEY?.length ?? null,
    supabaseServiceRoleKeyLength:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? null,
  });
}


