const MAX_CHUNK_LENGTH = 1800;

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function chunkText(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Translates text via the Google Translate `gtx` endpoint (CORS-enabled, no API key required).
 * Same mechanism used by the CMP admin app's translation preview.
 */
export async function translateText(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  if (!text.trim()) return text;

  const chunks = chunkText(text);
  const translated: string[] = [];

  for (const chunk of chunks) {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`
    );
    if (!res.ok) throw new Error(`Translation request failed (${res.status})`);

    // Response shape: [ [ ["translated_frag", "original_frag"], ... ], null, "en", ... ]
    const data = (await res.json()) as [[string, string][]];
    if (!data?.[0]) throw new Error('Unexpected response from translation service');

    translated.push(data[0].map(part => part[0]).filter(Boolean).join(''));
  }

  return translated.join(' ');
}
