import { Hono } from "hono";
import { cors } from "hono/cors";

import type { CloudflareBindings } from "./bindings";
import { chatRoute } from "./routes/chat";
import { documentsRoute } from "./routes/documents";
import { healthRoute } from "./routes/health";
import { sessionRoute } from "./routes/session";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", async (c, next) => {
  const rawOrigin = c.env.CORS_ORIGIN?.trim() ?? "";
  const allowedOrigins = rawOrigin
    ? rawOrigin.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  const handler = cors({
    origin: allowedOrigins.length > 0
      ? allowedOrigins
      : () => null,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "x-internal-secret",
      "x-sb-session-id",
    ],
    maxAge: 86400,
  });
  return handler(c, next);
});

app.onError((err, c) => {
  console.error("[unhandled]", err);
  return c.json({ error: "Erro interno." }, 500);
});

app.route("/health", healthRoute);
app.route("/chat", chatRoute);
app.route("/documents", documentsRoute);
app.route("/session", sessionRoute);

export default app;
