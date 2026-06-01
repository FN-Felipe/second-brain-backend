import { describe, expect, it } from "vitest";

import { chunkText } from "./chunking";

describe("chunkText", () => {
  it("returns empty array for empty or whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const result = chunkText("hello world");
    expect(result).toEqual(["hello world"]);
  });

  it("normalizes internal whitespace", () => {
    expect(chunkText("a\n\n  b\t c")).toEqual(["a b c"]);
  });

  it("splits long text into multiple chunks", () => {
    const text = "palavra ".repeat(1000).trim();
    const result = chunkText(text);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it("produces overlapping chunks to preserve context", () => {
    const text = Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
    const result = chunkText(text);
    expect(result.length).toBeGreaterThan(1);

    const firstTail = result[0]!.split(" ").slice(-3);
    const secondText = result[1]!;
    const hasOverlap = firstTail.some((word) => secondText.includes(word));
    expect(hasOverlap).toBe(true);
  });
});
