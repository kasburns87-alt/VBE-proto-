export function canApplyBrandForgeProfile(reference: unknown): reference is { id: number; status: "approved"; payload: Record<string, unknown> } {
  return Boolean(reference && typeof reference === "object" && (reference as { status?: unknown }).status === "approved" && typeof (reference as { payload?: unknown }).payload === "object");
}

export function getBrandForgePrefillState(input: { loading: boolean; error: boolean; count: number }) {
  if (input.loading) return "loading" as const;
  if (input.error) return "error" as const;
  return input.count ? "available" as const : "empty" as const;
}
