export function formatSize(
  value: number,
  inputUnit: "B" | "KB" | "MB" | "GB" | "TB" = "B",
  decimals: number = 2,
): string {
  const UNIT_MAP: Record<"B" | "KB" | "MB" | "GB" | "TB", number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  let bytes = value * UNIT_MAP[inputUnit];
  const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
  let unitIndex = 0;

  while (unitIndex < UNITS.length - 1 && bytes >= 1024) {
    bytes /= 1024;
    unitIndex++;
  }

  return `${parseFloat(bytes.toFixed(decimals))} ${UNITS[unitIndex]}`;
}
