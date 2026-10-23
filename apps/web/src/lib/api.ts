import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

/**
 * Typed fetch wrapper — attaches the Supabase access token to every call.
 * The API re-verifies the token (JWKS), so the frontend check is UX, not law.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: string;
        issues?: Array<{ path: string; message: string }>;
      };
      if (body.error) message = body.error;
      if (body.issues?.length) {
        message += ` — ${body.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
