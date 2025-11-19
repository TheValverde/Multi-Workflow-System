import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const getSupabaseServiceRoleClient = (): SupabaseClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = ensureEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (process.env.NODE_ENV === "development") {
    console.log("[supabase] config", {
      supabaseUrl,
      serviceRoleKeyLength: supabaseServiceRoleKey.length,
      hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    });
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
};


