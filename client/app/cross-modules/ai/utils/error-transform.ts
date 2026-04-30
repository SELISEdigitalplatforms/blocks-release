import { FastAPIError } from "@blocks-ai/types/ai.type";

type ErrorInput = {
  errors: { detail: FastAPIError };
};

type ErrorRecord = Record<string, string | string[]>;

function formatFieldName(fieldPath: string): string {
  const lastPart = fieldPath.split(".").pop() || fieldPath;
  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, " ");
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

export function ErrorTransformer(error: unknown): ErrorRecord {
  const result: ErrorRecord = {};

  if (!isErrorInput(error)) {
    return { non_field_error: "Something went wrong" };
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
        if (!result["non_field_error"]) {
          result["non_field_error"] = err;
        } else if (Array.isArray(result["non_field_error"])) {
          result["non_field_error"].push(err);
        } else {
          result["non_field_error"] = [result["non_field_error"], err];
        }
        continue;
      }

      // Validate that err has loc/msg/type
      if (!Array.isArray(err.loc) || typeof err.msg !== "string" || typeof err.type !== "string") {
        continue; // skip invalid entries
      }

      // Extract field path
      const fieldPath = err.loc
        .filter((p: string | number) => p !== "body" && p !== "query" && p !== "path")
        .join(".");
      if (!fieldPath) continue;

      // Transform "field required" -> "Username is required"
      const message =
        err.msg === "field required" ? `${formatFieldName(fieldPath)} is required` : err.msg;

      // Merge multiple messages for the same field
      if (result[fieldPath]) {
        if (Array.isArray(result[fieldPath])) {
          result[fieldPath].push(message);
        } else {
          result[fieldPath] = [result[fieldPath], message];
        }
      } else {
        result[fieldPath] = message;
      }
    }
  }

  return result;
}
