import { Hono } from "hono";
import { z } from "zod";

import type { CloudflareBindings } from "../bindings";
import { createDb } from "../db";
import { createAiProviders } from "../lib/ai";
import {
  deleteDocument,
  IngestError,
  ingestDocument,
  listDocuments,
} from "../lib/documents";
import { extractPdfText, PdfExtractionError } from "../lib/pdf";
import { getUserId, internalAuth } from "../middleware/internal-auth";

export const documentsRoute = new Hono<{ Bindings: CloudflareBindings }>();

documentsRoute.use("*", internalAuth);

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;

const textSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório.").max(200),
  content: z
    .string()
    .trim()
    .min(1, "Conteúdo obrigatório.")
    .max(MAX_TEXT_CHARS, "Conteúdo excede o limite de 100.000 caracteres."),
});

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

documentsRoute.get("/", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Não autenticado." }, 401);
  }
  const db = createDb(c.env.DATABASE_URL);
  const docs = await listDocuments(db, userId);
  return c.json({ documents: docs });
});

documentsRoute.post("/", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Não autenticado." }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const { embeddingModel } = createAiProviders(c.env.GOOGLE_GENERATIVE_AI_API_KEY);
  const contentType = c.req.header("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");

      if (!file || typeof (file as unknown as File).arrayBuffer !== "function") {
        return c.json({ error: "Arquivo ausente." }, 400);
      }
      const uploadedFile = file as unknown as File;
      if (uploadedFile.type !== "application/pdf") {
        return c.json({ error: "Apenas arquivos PDF são aceitos." }, 400);
      }
      if (uploadedFile.size > MAX_PDF_BYTES) {
        return c.json({ error: "Arquivo excede o limite de 10 MB." }, 400);
      }

      const buffer = await uploadedFile.arrayBuffer();
      if (!hasPdfSignature(new Uint8Array(buffer.slice(0, 4)))) {
        return c.json({ error: "Apenas arquivos PDF são aceitos." }, 400);
      }

      const text = await extractPdfText(buffer);
      if (!text) {
        return c.json(
          { error: "Não foi possível extrair texto do PDF." },
          422,
        );
      }

      const document = await ingestDocument({
        db,
        embeddingModel,
        userId,
        title: uploadedFile.name.replace(/\.pdf$/i, ""),
        sourceType: "pdf",
        rawContent: text,
      });
      return c.json({ document }, 201);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = textSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message ?? "Entrada inválida." },
        400,
      );
    }

    const document = await ingestDocument({
      db,
      embeddingModel,
      userId,
      title: parsed.data.title,
      sourceType: "text",
      rawContent: parsed.data.content,
    });
    return c.json({ document }, 201);
  } catch (error) {
    if (error instanceof IngestError) {
      return c.json({ error: error.message }, error.status);
    }
    if (error instanceof PdfExtractionError) {
      return c.json({ error: error.message }, 422);
    }
    console.error("[documents] ingest error:", error);
    return c.json({ error: "Falha ao processar documento." }, 500);
  }
});

documentsRoute.delete("/:id", async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Não autenticado." }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const id = c.req.param("id");
  const deleted = await deleteDocument(db, userId, id);
  if (!deleted) {
    return c.json({ error: "Documento não encontrado." }, 404);
  }

  return c.json({ ok: true });
});
