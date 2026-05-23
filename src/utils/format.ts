export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const negative = bytes < 0;
  const abs = Math.abs(bytes);
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(abs) / Math.log(1024)),
    units.length - 1,
  );
  const value = abs / Math.pow(1024, i);
  const formatted = value < 10 ? value.toFixed(2) : value.toFixed(1);
  return `${negative ? "-" : ""}${formatted} ${units[i]}`;
}

export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatBytes(delta)}`;
}
