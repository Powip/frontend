import { createClient } from "./supabase/server";

export async function isSuperAdmin() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return false;
    }

    // Checking role in user metadata (standard for this project's auth setup)
    const role = user.app_metadata?.role || user.user_metadata?.role;
    
    return role === "superadmin";
  } catch (err) {
    console.error("[RBAC] Error checking superadmin role:", err);
    return false;
  }
}

export async function getSession() {
  const supabase = await createClient();
  return await supabase.auth.getSession();
}
