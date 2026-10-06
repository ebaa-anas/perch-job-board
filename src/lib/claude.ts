import "server-only";

/**
 * Minimal Claude access via the Messages REST API — no SDK dependency, same
 * shape as `lib/email.ts`. Degrades gracefully: with no `ANTHROPIC_API_KEY`
 * it logs and returns `null`, so AI features never crash the page they live
 * on — callers just fall back to "unavailable".
 */

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";

/** Calls Claude with a system + user message and returns the raw text reply, or `null`. */
export async function callClaude(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.info("[claude] ANTHROPIC_API_KEY unset — skipped call");
    return null;
  }
  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: params.maxTokens ?? 400,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[claude] ${res.status}: ${body}`);
      return null;
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((block) => block.type === "text")?.text;
    return typeof text === "string" ? text : null;
  } catch (error) {
    console.error("[claude] request failed", error);
    return null;
  }
}
