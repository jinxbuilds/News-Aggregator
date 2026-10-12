/** Reads an optional secret, treating empty values and README placeholders as unset. */
export function secret(name: string): string | undefined {
  const value = (process.env[name] ?? "").trim();
  return !value || value.startsWith("your-") ? undefined : value;
}
