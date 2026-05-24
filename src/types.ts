export type FileKind = "runtime" | "sourcemap";
export type FileCategory =
  | "js"
  | "css"
  | "font"
  | "image"
  | "sourcemap"
  | "other";

export interface CategoryStats {
  count: number;
  size: number;
  gzipSize: number;
}

// A single file in a bundle build
export interface FileEntry {
  /** Absolute path on disk */
  absolutePath: string;
  /** Path relative to the build root (e.g. "assets/index-abc123.js") */
  path: string;
  /** Logical path with hash stripped (e.g. "assets/index.js") — used to match files across builds */
  logicalPath: string;
  /** Raw size in bytes */
  size: number;
  /** Gzipped size in bytes */
  gzipSize: number;
  /** File extension (js, css, html, etc.) */
  ext: string;
  kind: FileKind;
  category: FileCategory;
}

// A snapshot of an entire build directory
export interface BundleSnapshot {
  /** Build directory that was scanned */
  buildDir: string;
  /** When this snapshot was captured (ISO string) */
  capturedAt: string;
  /** Total raw size across runtime files */
  totalSize: number;
  /** Total gzipped size across runtime files */
  totalGzipSize: number;
  /** Total raw size across all files */
  totalSizeAll: number;
  /** Total gzipped size across all files */
  totalGzipSizeAll: number;
  /** All files in the build */
  byCategory: Record<FileCategory, CategoryStats>;
  files: FileEntry[];
}

export interface CategoryDiff {
  sizeBefore: number;
  sizeAfter: number;
  sizeDelta: number;
  gzipBefore: number;
  gzipAfter: number;
  gzipDelta: number;
  countBefore: number;
  countAfter: number;
}

export interface BundleDiff {
  base: { capturedAt: string; buildDir: string };
  head: { capturedAt: string; buildDir: string };

  // High-level totals
  totals: {
    sizeBefore: number;
    sizeAfter: number;
    sizeDelta: number;
    gzipBefore: number;
    gzipAfter: number;
    gzipDelta: number;
  };

  // Per-category deltas — most useful "summary" view
  byCategory: Record<FileCategory, CategoryDiff>;

  // Per-file changes — the detail
  files: FileDiff[];
}

export interface FileDiff {
  logicalPath: string; // the key — matches across builds
  category: FileCategory;
  changeType: "added" | "removed" | "modified" | "unchanged";
  sizeBefore: number; // 0 if added
  sizeAfter: number; // 0 if removed
  sizeDelta: number;
  gzipBefore: number;
  gzipAfter: number;
  gzipDelta: number;
  // For modified files, the actual (hashed) paths in each build, helpful for debugging
  pathBefore?: string;
  pathAfter?: string;
}
