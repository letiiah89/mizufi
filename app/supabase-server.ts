export type MizufiUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function getMizufiUser(request: Request): Promise<MizufiUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: authorization,
    },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: { display_name?: string; full_name?: string };
  };
  if (!user.id || !user.email) return null;

  return {
    id: user.id,
    email: user.email.toLowerCase(),
    displayName:
      user.user_metadata?.display_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.email.split("@")[0],
  };
}
