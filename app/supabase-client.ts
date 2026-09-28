"use client";

import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("La configuración de acceso de Mizufi no está disponible.");
}

const rememberSessionKey = "mizufi-remember-session";
const savedAccountsKey = "mizufi-saved-accounts";

export type SavedMizufiAccount = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
};

function shouldRememberSession() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(rememberSessionKey) !== "false";
}

const authStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return shouldRememberSession()
      ? window.localStorage.getItem(key)
      : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const preferred = shouldRememberSession() ? window.localStorage : window.sessionStorage;
    const other = shouldRememberSession() ? window.sessionStorage : window.localStorage;
    preferred.setItem(key, value);
    other.removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function setRememberSession(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(rememberSessionKey, String(remember));
}

export function getSavedAccounts(): SavedMizufiAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedAccountsKey) ?? "[]") as SavedMizufiAccount[];
    return Array.isArray(parsed) ? parsed.filter((account) => account.userId && account.email && account.refreshToken) : [];
  } catch {
    return [];
  }
}

export function rememberAccountSession(session: Session) {
  if (typeof window === "undefined" || !shouldRememberSession()) return;
  const accounts = getSavedAccounts().filter((account) => account.userId !== session.user.id);
  accounts.unshift({
    userId: session.user.id,
    email: session.user.email ?? session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  });
  window.localStorage.setItem(savedAccountsKey, JSON.stringify(accounts.slice(0, 8)));
}

export function forgetSavedAccount(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(savedAccountsKey, JSON.stringify(getSavedAccounts().filter((account) => account.userId !== userId)));
}

export async function activateSavedAccount(userId: string) {
  const account = getSavedAccounts().find((item) => item.userId === userId);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const { data, error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error || !data.session) {
    forgetSavedAccount(userId);
    throw error ?? new Error("SESSION_EXPIRED");
  }
  rememberAccountSession(data.session);
  return data.session;
}

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
