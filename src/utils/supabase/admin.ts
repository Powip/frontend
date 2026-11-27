import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la service role, solo para rutas de servidor
 * (`/api/superadmin/*` y webhooks). No usa cookies ni sesión de Supabase.
 *
 * FEAT-23 T16: desde el 2026-11-27 el rol `anon` no tiene permisos en el
 * schema `public`, así que no hay vuelta atrás a la anon key: si falta la
 * service role, se corta acá con un error claro en vez de fallar después
 * con un "permission denied" de Postgres.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el cliente admin de Supabase"
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
