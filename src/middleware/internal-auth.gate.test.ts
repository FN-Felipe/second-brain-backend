import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { CloudflareBindings } from "../bindings";
import { internalAuth } from "./internal-auth";

async function gate(secret: string, header: string | null): Promise<number> {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.use("*", internalAuth);
  app.get("/x", (c) => c.text("OK", 200));

  const headers: Record<string, string> = {};
  if (header !== null) headers["x-internal-secret"] = header;

  const req = new Request("http://localhost/x", { headers });
  const res = await app.fetch(req, { INTERNAL_API_SECRET: secret } as CloudflareBindings);
  return res.status;
}

const S = "supersecret-test-value";

describe("internalAuth gate", () => {
  it("fecha quando o segredo não está configurado", async () => {
    expect(await gate("", null)).toBe(403);
    expect(await gate("", "qualquer")).toBe(403);
  });

  it("rejeita header ausente, errado ou de tamanho diferente", async () => {
    expect(await gate(S, null)).toBe(403);
    expect(await gate(S, "wrong")).toBe(403);
    expect(await gate(S, "s")).toBe(403);
    expect(await gate(S, S + "x")).toBe(403);
  });

  it("aceita o segredo correto", async () => {
    expect(await gate(S, S)).toBe(200);
  });
});
