export function mergeReviewMenus(
  currentMenus: readonly string[],
  candidates: readonly string[],
): string[] {
  const merged = [...currentMenus];
  for (const candidate of candidates) {
    const menu = candidate.trim();
    if (menu && !merged.includes(menu)) merged.push(menu);
  }
  return merged;
}
