import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";

export const EMBEDDING_DIMENSIONS = 1536;

export const DOCUMENT_EMBEDDING_OPTIONS = {
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType: "RETRIEVAL_DOCUMENT",
  },
};

export const QUERY_EMBEDDING_OPTIONS = {
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType: "RETRIEVAL_QUERY",
  },
};

export type AiProviders = {
  chatModel: LanguageModel;
  embeddingModel: EmbeddingModelV3;
};

export function createAiProviders(apiKey: string): AiProviders {
  const google = createGoogleGenerativeAI({ apiKey });
  return {
    chatModel: google("gemini-2.5-flash"),
    embeddingModel: google.embedding("gemini-embedding-001"),
  };
}
