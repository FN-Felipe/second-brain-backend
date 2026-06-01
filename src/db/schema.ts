import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", ["text", "pdf"]);
export const documentStatusEnum = pgEnum("document_status", [
  "processing",
  "ready",
  "error",
]);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  rawContent: text("raw_content").notNull(),
  status: documentStatusEnum("status").notNull().default("processing"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("chunks_user_id_idx").on(table.userId),
    index("chunks_document_id_idx").on(table.documentId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
