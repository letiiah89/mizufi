import { env } from "cloudflare:workers";

function getSupabaseAdminKey() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || runtimeEnv.SUPERBASE_SERVICE_ROLE_KEY;
}

export async function deleteSupabaseUser(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getSupabaseAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin is not configured");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ should_soft_delete: false }),
  });

  if (!response.ok) {
    throw new Error(`Supabase user deletion failed with status ${response.status}`);
  }
}
