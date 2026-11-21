/** Escapes user text so it is matched literally inside a $regex (prevents regex injection / ReDoS). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Converts a whitelisted sort string like "-createdAt" into a Mongo sort object. */
export function toSort(sort: string): Record<string, 1 | -1> {
  return sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };
}
