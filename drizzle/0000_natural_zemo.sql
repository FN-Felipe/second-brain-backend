CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('text', 'pdf');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"raw_content" text NOT NULL,
	"status" "document_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_user_id_idx" ON "chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chunks_document_id_idx" ON "chunks" USING btree ("document_id");