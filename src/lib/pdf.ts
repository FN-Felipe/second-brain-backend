import { extractText, getDocumentProxy } from "unpdf";

const EXTRACT_TIMEOUT_MS = 15_000;
const MAX_EXTRACTED_CHARS = 500_000;

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const extraction = (async () => {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PdfExtractionError("Tempo limite ao processar o PDF.")),
      EXTRACT_TIMEOUT_MS,
    );
  });

  try {
    const text = await Promise.race([extraction, timeout]);
    return text.slice(0, MAX_EXTRACTED_CHARS).trim();
  } finally {
    clearTimeout(timer);
  }
}
