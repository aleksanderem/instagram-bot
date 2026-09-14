import type { ConversationPair } from "./types.js";

// Polish glue words carry no topic, so they must not make two texts look related.
const FILLER = new Set([
  "jest", "nie", "sie", "tak", "czy", "jak", "dla", "oraz", "ale", "bez", "pod", "nad",
  "przy", "tez", "tylko", "bardzo", "moze", "gdy", "juz", "byl", "byla", "bylo", "tym",
  "ten", "tego", "tym", "kto", "gdzie", "kiedy", "wiec", "albo", "lub", "jeszcze"
]);

const MIN_WORD_LENGTH = 3;
// Polish inflects endings heavily; comparing word beginnings matches "grzaniem" with "grzanie".
const STEM_LENGTH = 6;

const stripDiacritics = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replaceAll("ł", "l").replaceAll("Ł", "L");

/** Topic-carrying word stems of a text, used to judge how related two texts are. */
export function meaningfulWords(text: string): string[] {
  return stripDiacritics(text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !FILLER.has(word))
    .map((word) => word.slice(0, STEM_LENGTH));
}

export function similarityScore(a: string, b: string): number {
  const left = new Set(meaningfulWords(a));
  const right = new Set(meaningfulWords(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.sqrt(left.size * right.size);
}

/** Past conversations whose question is closest in topic to `text`, best first. */
export function findSimilarPairs(pairs: ConversationPair[], text: string, limit: number): ConversationPair[] {
  return pairs
    .map((pair) => ({ pair, score: similarityScore(pair.question, text) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((scored) => scored.pair);
}
