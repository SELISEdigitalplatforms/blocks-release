import { tStatic } from "@seliseblocks/genesis-os";
import type { FastAPIError } from "@/models";

type ErrorInput = {
  errors: { detail: FastAPIError };
};

type ErrorRecord = Record<string, string | string[]>;

function formatFieldName(fieldPath: string): string {
  const lastPart = fieldPath.split(".").pop() || fieldPath;
  return (
    lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, " ")
  );
}

function isErrorInput(error: unknown): error is ErrorInput {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    typeof (error as { errors: unknown })["errors"] === "object" &&
    errorsHasDetail((error as { errors: unknown })["errors"])
  );
}

function errorsHasDetail(errors: unknown): errors is { detail: FastAPIError } {
  return typeof errors === "object" && errors !== null && "detail" in errors;
}

// Adds a message under a key; a second message for the same key turns the value into a list.
function addMessage(result: ErrorRecord, key: string, message: string): void {
  const current = result[key];
  if (!current) {
    result[key] = message;
  } else if (Array.isArray(current)) {
    current.push(message);
  } else {
    result[key] = [current, message];
  }
}

// One validation entry (loc/msg/type) as its field path and message; null when it has no usable field.
function toFieldMessage(err: {
  loc?: unknown;
  msg?: unknown;
  type?: unknown;
}): { field: string; message: string } | null {
  if (!Array.isArray(err.loc) || typeof err.msg !== "string" || typeof err.type !== "string") {
    return null; // skip invalid entries
  }
  const field = err.loc
    .filter((p: string | number) => p !== "body" && p !== "query" && p !== "path")
    .join(".");
  if (!field) return null;
  // Transform "field required" -> "Username is required"
  const message =
    err.msg === "field required"
      ? tStatic("release.shared", "ERROR_TRANSFORM.FIELD_REQUIRED", { field: formatFieldName(field) })
      : err.msg;
  return { field, message };
}

export function ErrorTransformer(error: unknown): ErrorRecord {
  const result: ErrorRecord = {};

  if (!isErrorInput(error)) {
    return { non_field_error: tStatic("release.shared", "ERROR_TRANSFORM.SOMETHING_WENT_WRONG") };
  }

  const { detail } = error.errors;

  // Case 1: plain string -> global error
  if (typeof detail === "string") {
    result["non_field_error"] = detail;
    return result;
  }

  // Case 2: array of validation errors
  if (Array.isArray(detail)) {
    for (const err of detail) {
      // Rare case: item is a string
      if (typeof err === "string") {
        addMessage(result, "non_field_error", err);
        continue;
      }
      const entry = toFieldMessage(err);
      if (entry) addMessage(result, entry.field, entry.message);
    }
  }

  return result;
}
