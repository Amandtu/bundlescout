import { FileEntry } from "../types";

/**
 * Build a Map<key, FileEntry> for diffing.
 *
 * Uses `logicalPath` as the key when it's unique within the snapshot,
 * falls back to the original `path` (with hash) when multiple files share
 * the same logical path. This prevents silent overwrites for files that
 * legitimately coexist with the same base name (e.g. multiple entry
 * points in a multi-entry Vite build).
 *
 * Files keyed by full `path` won't match across builds when hashes change,
 * so they'll show as removed+added rather than modified. This is correct
 * behavior — we can't reliably match them without bundler metadata.
 */
export function buildLookupMap(files: FileEntry[]): Map<string, FileEntry> {
  // First pass: count how many files share each logicalPath
  const logicalCounts = new Map<string, number>();
  for (const f of files) {
    logicalCounts.set(
      f.logicalPath,
      (logicalCounts.get(f.logicalPath) ?? 0) + 1,
    );
  }

  // Second pass: key by logicalPath if unique, otherwise by full path
  const map = new Map<string, FileEntry>();
  for (const f of files) {
    const key =
      (logicalCounts.get(f.logicalPath) ?? 0) > 1 ? f.path : f.logicalPath;
    map.set(key, f);
  }
  return map;
}
