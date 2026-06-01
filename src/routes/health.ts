import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { CloudflareBindings } from "../bindings";
import { createDb } from "../db";
import { internalAuth } from "../middleware/internal-auth";

export const healthRoute = new Hono<{ Bindings: CloudflareBindings }>();

healthRoute.use("*", internalAuth);

healthRoute.get("/", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "connected" });
  } catch (error) {
    console.error("[health] db check failed:", error);
    return c.json({ status: "error", db: "disconnected" }, 503);
  }
});
