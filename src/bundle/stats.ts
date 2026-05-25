import path from "node:path";
import { promises as fs } from "node:fs";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import fg from "fast-glob";
import type {
  BundleSnapshot,
  CategoryStats,
  FileCategory,
  FileEntry,
  FileKind,
} from "../types";
import { EXTENSION_CATEGORIES } from "../constants";

const gzipAsync = promisify(gzip);

function classifyCategory(relPath: string, kind: FileKind): FileCategory {
  if (kind === "sourcemap") return "sourcemap";
  const ext = path.extname(relPath).slice(1).toLowerCase();
  return EXTENSION_CATEGORIES[ext] ?? "other";
}

export function stripHash(filename: string): string {
  return filename.replace(/-[A-Za-z0-9_]{8}((?:\.[a-z0-9]+){1,2})$/i, "$1");
}

function emptyCategoryTotals(): Record<FileCategory, CategoryStats> {
  const categories: FileCategory[] = [
    "js",
    "css",
    "font",
    "image",
    "sourcemap",
    "other",
  ];
  const totals = {} as Record<FileCategory, CategoryStats>;
  for (const c of categories) {
    totals[c] = { count: 0, size: 0, gzipSize: 0 };
  }
  return totals;
}

export async function captureSnapshot(
  buildDir: string,
): Promise<BundleSnapshot> {
  const absoluteBuildDir = path.resolve(buildDir);

  const stat = await fs.stat(absoluteBuildDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(
      `Build directory not found or not a directory: ${absoluteBuildDir}`,
    );
  }

  const entries = await fg("**/*", {
    cwd: absoluteBuildDir,
    onlyFiles: true,
    dot: false,
  });

  const files: FileEntry[] = await Promise.all(
    entries.map(async (relPath) => {
      const absolutePath = path.join(absoluteBuildDir, relPath);
      const buffer = await fs.readFile(absolutePath);
      const gzipped = await gzipAsync(buffer);
      const ext = path.extname(relPath).slice(1).toLowerCase();
      const dir = path.dirname(relPath);
      const base = path.basename(relPath);
      const logicalBase = stripHash(base);
      const logicalPath =
        dir === "." ? logicalBase : path.join(dir, logicalBase);
      const kind = relPath.endsWith(".map") ? "sourcemap" : "runtime";
      const category = classifyCategory(relPath, kind);

      return {
        absolutePath,
        path: relPath,
        logicalPath,
        size: buffer.byteLength,
        gzipSize: gzipped.byteLength,
        ext,
        kind,
        category,
      };
    }),
  );

  const byCategory = emptyCategoryTotals();
  let totalSize = 0;
  let totalGzipSize = 0;
  let totalSizeAll = 0;
  let totalGzipSizeAll = 0;

  for (const f of files) {
    totalSizeAll += f.size;
    totalGzipSizeAll += f.gzipSize;

    if (f.kind === "runtime") {
      totalSize += f.size;
      totalGzipSize += f.gzipSize;
    }

    byCategory[f.category].count += 1;
    byCategory[f.category].size += f.size;
    byCategory[f.category].gzipSize += f.gzipSize;
  }

  return {
    buildDir: absoluteBuildDir,
    capturedAt: new Date().toISOString(),
    totalSize,
    totalGzipSize,
    totalSizeAll,
    totalGzipSizeAll,
    byCategory,
    files: files.sort((a, b) => b.size - a.size),
  };
}
