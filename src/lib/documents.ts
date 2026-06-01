import { embedMany } from "ai";
import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import { and, desc, eq, lt, sql } from "drizzle-orm";

import type { Database } from "../db";
import { chunks, documents } from "../db/schema";

import { DOCUMENT_EMBEDDING_OPTIONS } from "./ai";
import { chunkText } from "./chunking";

const MAX_DOCUMENTS_PER_SESSION = 50;
const MAX_CHUNKS_PER_DOCUMENT = 200;
const EMBED_BATCH_SIZE = 100;

export class IngestError extends Error {
  readonly status: 400 | 422;
  constructor(message: string, status: 400 | 422 = 400) {
    super(message);
    this.name = "IngestError";
    this.status = status;
  }
}

type IngestInput = {
  db: Database;
  embeddingModel: EmbeddingModelV3;
  userId: string;
  title: string;
  sourceType: "text" | "pdf";
  rawContent: string;
};

async function embedInBatches(
  model: EmbeddingModelV3,
  values: string[],
): Promise<number[][]> {
  const result: number[][] = [];
  for (let i = 0; i < values.length; i += EMBED_BATCH_SIZE) {
    const { embeddings } = await embedMany({
      model,
      values: values.slice(i, i + EMBED_BATCH_SIZE),
      providerOptions: DOCUMENT_EMBEDDING_OPTIONS,
    });
    result.push(...embeddings);
  }
  return result;
}

export async function ingestDocument({
  db,
  embeddingModel,
  userId,
  title,
  sourceType,
  rawContent,
}: IngestInput) {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.userId, userId));

  if (count >= MAX_DOCUMENTS_PER_SESSION) {
    throw new IngestError("Limite de documentos por sessão atingido.");
  }

  const pieces = chunkText(rawContent).slice(0, MAX_CHUNKS_PER_DOCUMENT);
  if (pieces.length === 0) {
    throw new IngestError("Conteúdo vazio após processamento.", 422);
  }

  const [document] = await db
    .insert(documents)
    .values({ userId, title, sourceType, rawContent, status: "processing" })
    .returning();

  if (!document) {
    throw new Error("Falha ao criar o documento.");
  }

  try {
    const embeddings = await embedInBatches(embeddingModel, pieces);

    await db.insert(chunks).values(
      pieces.map((content, index) => ({
        documentId: document.id,
        userId,
        content,
        chunkIndex: index,
        embedding: embeddings[index]!,
      })),
    );

    const [ready] = await db
      .update(documents)
      .set({ status: "ready" })
      .where(eq(documents.id, document.id))
      .returning();

    return ready ?? document;
  } catch (error) {
    await db
      .update(documents)
      .set({ status: "error" })
      .where(eq(documents.id, document.id));
    throw error;
  }
}

export async function listDocuments(db: Database, userId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      sourceType: documents.sourceType,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(
  db: Database,
  userId: string,
  documentId: string,
) {
  const [deleted] = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning({ id: documents.id });

  return deleted ?? null;
}

export async function deleteAllDocuments(db: Database, userId: string) {
  const deleted = await db
    .delete(documents)
    .where(eq(documents.userId, userId))
    .returning({ id: documents.id });

  return deleted.length;
}

export async function deleteStaleDocuments(db: Database, olderThan: Date) {
  const deleted = await db
    .delete(documents)
    .where(lt(documents.createdAt, olderThan))
    .returning({ id: documents.id });

  return deleted.length;
}
