interface ErrorLike {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Extracts useful Supabase/PostgREST error details from unknown thrown values. */
export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (!isErrorLike(error)) {
    return fallbackMessage;
  }

  const message = toOptionalString(error.message);
  const details = toOptionalString(error.details);
  const hint = toOptionalString(error.hint);
  const code = toOptionalString(error.code);
  const parts = [message, details, hint, code === null ? null : `Code: ${code}`].filter(
    (part): part is string => part !== null,
  );

  return parts.length === 0 ? fallbackMessage : parts.join(" ");
}
