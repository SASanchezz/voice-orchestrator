/** Any value as text, exactly as String() writes it; for untyped input such as a tool call's arguments. */
export function asText(value: unknown): string {
  return String(value);
}
