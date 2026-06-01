import { embed } from "ai";
import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";

import type { Database } from "../db";
import { chunks, documents } from "../db/schema";

import { QUERY_EMBEDDING_OPTIONS } from "./ai";

export type RetrievedChunk = {
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
};

const TOP_K = 5;
const MIN_SIMILARITY = 0.2;

export async function retrieveRelevantChunks(
  db: Database,
  embeddingModel: EmbeddingModelV3,
  userId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: QUERY_EMBEDDING_OPTIONS,
  });

  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`;

  return db
    .select({
      content: chunks.content,
      documentId: chunks.documentId,
      documentTitle: documents.title,
      similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(eq(chunks.userId, userId), gt(similarity, MIN_SIMILARITY)))
    .orderBy(desc(similarity))
    .limit(TOP_K);
}

export function buildContextBlock(retrieved: RetrievedChunk[]): string {
  return retrieved
    .map(
      (chunk, index) =>
        `<<FONTE ${index + 1} | ${chunk.documentTitle}>>\n${chunk.content}\n<<FIM FONTE ${index + 1}>>`,
    )
    .join("\n\n");
}
