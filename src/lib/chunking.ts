const CHARS_PER_CHUNK = 2000;
const OVERLAP_CHARS = 200;

export function chunkText(input: string): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= CHARS_PER_CHUNK) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHARS_PER_CHUNK, text.length);

    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start) end = boundary;
    }

    chunks.push(text.slice(start, end).trim());

    if (end >= text.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks.filter((c) => c.length > 0);
}
