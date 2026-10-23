/** Express 5 route params are `string | string[]` — normalize to a plain string. */
export function param(req: { params: Record<string, string | string[]> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
