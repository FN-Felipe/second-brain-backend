import { Hono } from "hono";

import type { CloudflareBindings } from "../bindings";
import { createDb } from "../db";
import { deleteAllDocuments, deleteStaleDocuments } from "../lib/documents";
import { getUserId, internalAuth } from "../middleware/internal-auth";

export const sessionRoute = new Hono<{ Bindings: CloudflareBindings }>();

sessionRoute.use("*", internalAuth);

sessionRoute.post("/reset", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const sessionTtlHours = Number(c.env.SESSION_TTL_HOURS ?? 2);
  const cutoff = new Date(Date.now() - sessionTtlHours * 60 * 60 * 1000);

  const stale = await deleteStaleDocuments(db, cutoff);

  const sessionId = getUserId(c);
  const own = sessionId ? await deleteAllDocuments(db, sessionId) : 0;

  return c.json({ ok: true, deleted: own + stale });
});
