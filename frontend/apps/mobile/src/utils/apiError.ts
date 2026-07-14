/** Extract the first human-readable error from an API response. */
export function getFirstError(error: unknown, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.errors === "string") return obj.errors;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.error === "string") return obj.error;
    if (Array.isArray(obj.non_field_errors) && obj.non_field_errors[0]) {
      return String(obj.non_field_errors[0]);
    }
    for (const val of Object.values(obj)) {
      if (typeof val === "string") return val;
      if (Array.isArray(val) && val[0]) return String(val[0]);
    }
  }
  return fallback;
}

/** Unwrap axios-like `{ data }` or `{ error }` responses. */
export function unwrap<T>(res: { data?: T; error?: unknown } | T): T {
  if (res && typeof res === "object" && "error" in res && (res as { error?: unknown }).error) {
    throw new Error(getFirstError((res as { error: unknown }).error));
  }
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}
