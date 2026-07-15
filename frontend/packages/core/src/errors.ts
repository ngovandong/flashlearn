// Extract a human-friendly first error from a DRF-style error payload.
// Payloads look like { field: ["msg", ...] } or { error: "msg" }.

export function getFirstError(data: unknown): string {
  if (typeof data === "string") {
    return "Something went wrong. Please try again.";
  }
  if (!data || typeof data !== "object") {
    return "Something went wrong. Please try again.";
  }
  const record = data as Record<string, unknown>;
  const firstKeyError = Object.keys(record)[0];
  const firstErrors = record[firstKeyError];
  if (Array.isArray(firstErrors)) {
    return `${firstKeyError}: ${firstErrors[0]}`;
  }
  return firstErrors as string;
}
