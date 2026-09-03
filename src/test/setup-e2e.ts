import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env.local" });

/* -------------------------------------------------------------------------- */
/*  Mock Next.js request plumbing so "use server" actions run under vitest.    */
/* -------------------------------------------------------------------------- */

// server-only throws outside an RSC bundler.
vi.mock("server-only", () => ({}));

// React.cache needs a request scope; a passthrough is correct for tests.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

// revalidatePath / revalidateTag are no-ops here.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}));

// redirect() / notFound() throw sentinels the tests can catch.
export class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
    this.name = "RedirectError";
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundError";
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  permanentRedirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new NotFoundError();
  },
}));

/* -------------------------------------------------------------------------- */
/*  Mutable cookie jar backing next/headers cookies()                          */
/* -------------------------------------------------------------------------- */

type Cookie = { name: string; value: string };
const jar = new Map<string, string>();

export function resetCookies(entries: Cookie[] = []): void {
  jar.clear();
  for (const { name, value } of entries) jar.set(name, value);
}

export function currentCookies(): Cookie[] {
  return [...jar.entries()].map(([name, value]) => ({ name, value }));
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => currentCookies(),
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    has: (name: string) => jar.has(name),
    set: (
      name: string | { name: string; value: string },
      value?: string,
    ) => {
      if (typeof name === "object") jar.set(name.name, name.value);
      else jar.set(name, value ?? "");
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));
