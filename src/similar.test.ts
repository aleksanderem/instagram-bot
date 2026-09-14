import { describe, expect, it } from "vitest";
import { findSimilarPairs, meaningfulWords } from "./similar.js";

const pair = (question: string, answer: string) => ({ question, answer, source: "instagram-comment" });

describe("meaningfulWords", () => {
  it("ignores case, punctuation and Polish diacritics", () => {
    expect(meaningfulWords("Lubiłaś się grzać!")).toEqual(meaningfulWords("lubilas sie grzac"));
  });

  it("matches different endings of the same word", () => {
    const [grzanie] = meaningfulWords("grzaniem");
    const [grzac] = meaningfulWords("grzanie");
    expect(grzanie).toBe(grzac);
  });

  it("drops filler words that carry no topic", () => {
    expect(meaningfulWords("a to jest i za")).toEqual([]);
  });
});

describe("findSimilarPairs", () => {
  const pairs = [
    pair("Przecież lubiłaś się grzać po mefedronie", "Nie komentuję takich sugestii. Jeśli chcesz porozmawiać o uzależnieniu, napisz prywatnie."),
    pair("Ile kosztuje konsultacja?", "Szczegóły cennika wysyłamy prywatnie."),
    pair("Jak długo trwa detoks?", "To zależy od historii — opowiem o tym w wiadomości prywatnej.")
  ];

  it("finds the past reply to a topically similar provocation", () => {
    const [best] = findSimilarPairs(pairs, "lubiłaś grzanie mefedronem, co?", 3);
    expect(best.answer).toContain("Nie komentuję takich sugestii");
  });

  it("returns nothing when no past conversation shares any topic", () => {
    expect(findSimilarPairs(pairs, "zzz qqq", 3)).toEqual([]);
  });

  it("never returns more pairs than asked for", () => {
    expect(findSimilarPairs(pairs, "konsultacja detoks mefedron", 2).length).toBeLessThanOrEqual(2);
  });
});
