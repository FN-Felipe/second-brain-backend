import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

import type { CloudflareBindings } from "../bindings";

const SESSION_HEADER = "x-sb-session-id";

function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export const internalAuth: MiddlewareHandler<{
  Bindings: CloudflareBindings;
}> = async (c, next) => {
  const secret = c.env.INTERNAL_API_SECRET;
  if (!secret) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const incoming = c.req.header("x-internal-secret") ?? "";
  if (!safeEqual(incoming, secret)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
};

export function getUserId(c: {
  req: { header: (name: string) => string | undefined };
}): string | null {
  return c.req.header(SESSION_HEADER) || null;
}
