import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createRouteClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[createRouteClient] Missing Supabase environment variables");
    throw new Error("Supabase configuration missing");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (err) {
          // Normal in some environments when headers are already sent
        }
      },
    },
  });
}


