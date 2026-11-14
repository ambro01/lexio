/** Same folding as the database's word_key / name_key: lowercase, trimmed, inner whitespace collapsed. */
export function toKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
