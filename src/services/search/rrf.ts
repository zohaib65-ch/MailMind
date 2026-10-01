/**
 * Reciprocal Rank Fusion: merges ranked lists (e.g. keyword + semantic) without having to
 * compare their incompatible scores. Each item scores Σ 1 / (k + rank) over the lists it
 * appears in; k = 60 is the constant from the original paper (Cormack et al., 2009).
 */
export function reciprocalRankFusion<T extends { id: string }>(
  lists: { name: string; items: T[] }[],
  k = 60,
): { id: string; score: number; matchedBy: string[]; item: T }[] {
  const fused = new Map<string, { id: string; score: number; matchedBy: string[]; item: T }>();
  for (const list of lists) {
    list.items.forEach((item, index) => {
      const entry = fused.get(item.id) ?? { id: item.id, score: 0, matchedBy: [], item };
      entry.score += 1 / (k + index + 1);
      if (!entry.matchedBy.includes(list.name)) entry.matchedBy.push(list.name);
      fused.set(item.id, entry);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score);
}
