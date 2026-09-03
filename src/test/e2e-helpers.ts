import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { resetCookies, currentCookies, RedirectError } from "@/test/setup-e2e";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const PASSWORD = "perch-e2e-pw-abc123";

export function service() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

const createdUsers = new Set<string>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry any Supabase builder/promise through transient `fetch failed` / 5xx. */
export async function retry<T extends { error: unknown }>(
  label: string,
  fn: () => PromiseLike<T>,
): Promise<T> {
  let last = "";
  for (let i = 0; i < 5; i += 1) {
    try {
      const res = await fn();
      if (!res.error) return res;
      last = (res.error as { message?: string }).message ?? String(res.error);
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await wait(1200 * (i + 1));
  }
  throw new Error(`${label} failed after retries: ${last}`);
}

export async function makeUser(
  email: string,
  role: "seeker" | "recruiter" | null,
  fullName = "E2E User",
): Promise<string> {
  const { data } = await retry(`makeUser(${email})`, () =>
    service().auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: role
        ? { full_name: fullName, role }
        : { full_name: fullName },
    }),
  );
  createdUsers.add(data.user!.id);
  return data.user!.id;
}

export async function makeAdmin(email: string): Promise<string> {
  const id = await makeUser(email, null, "E2E Admin");
  await retry("admin_emails upsert", () =>
    service()
      .from("admin_emails")
      .upsert({ email: email.toLowerCase() }, { onConflict: "email" }),
  );
  await retry("promote admin", () =>
    service().from("profiles").update({ role: "admin" }).eq("id", id),
  );
  return id;
}

/** Retry-wrapped `insert(...).select(...).single()` for test fixtures. */
export async function seedRow<T = { id: string }>(
  label: string,
  table: string,
  row: Record<string, unknown>,
  columns = "id",
): Promise<T> {
  const { data } = await retry(label, () =>
    service().from(table).insert(row).select(columns).single(),
  );
  return data as T;
}

export async function cleanupUsers(): Promise<void> {
  const svc = service();
  for (const id of createdUsers) {
    await svc.auth.admin.deleteUser(id).catch(() => {});
  }
  createdUsers.clear();
}

export async function cleanupAdminEmail(email: string): Promise<void> {
  await service().from("admin_emails").delete().eq("email", email.toLowerCase());
}

const sessionCache = new Map<string, { name: string; value: string }[]>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Installs an authenticated session for `email` into the mocked next/headers
 * store, so the app's own createClient() is signed in for the rest of the test.
 *
 * The @supabase/ssr server client mints the exact cookie the app expects. The
 * result is cached per email (access tokens last ~1h) so a suite of dozens of
 * tests doesn't hammer GoTrue's password-grant rate limit.
 */
export async function actingAs(email: string): Promise<void> {
  const cached = sessionCache.get(email);
  if (cached) {
    resetCookies(cached.map((c) => ({ ...c })));
    return;
  }

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const jar = new Map<string, string>();
    const supa = createServerClient(URL, ANON, {
      cookies: {
        getAll: () =>
          [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const { error } = await supa.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (!error) {
      const entries = [...jar.entries()].map(([name, value]) => ({ name, value }));
      sessionCache.set(email, entries);
      resetCookies(entries.map((c) => ({ ...c })));
      return;
    }
    lastErr = error.message;
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`actingAs(${email}) failed after retries: ${lastErr}`);
}

export function actingAsGuest(): void {
  resetCookies([]);
}

/** Cookie header string for the CURRENT mocked session (for HTTP calls). */
export function cookieHeader(): string {
  return currentCookies()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

/** Await a server action, asserting it redirected, and return the target path. */
export async function expectRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect, but the action returned normally");
}

export const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
