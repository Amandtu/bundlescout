import {
  BundleDiff,
  BundleSnapshot,
  CategoryDiff,
  FileCategory,
  FileDiff,
  FileEntry,
  FileKind,
} from "../types";
import { buildLookupMap } from "../utils/buildFilesLookup";

function categorize(
  prev: FileEntry | undefined,
  curr: FileEntry | undefined,
): FileDiff["changeType"] {
  if (!prev && curr) return "added";
  if (prev && !curr) return "removed";
  if (!prev || !curr) throw new Error("unreachable");
  return prev.size === curr.size && prev.gzipSize === curr.gzipSize
    ? "unchanged"
    : "modified";
}

function emptyCategoryDiffs(): Record<FileCategory, CategoryDiff> {
  const categories: FileCategory[] = [
    "js",
    "css",
    "font",
    "image",
    "sourcemap",
    "other",
  ];
  const totals = {} as Record<FileCategory, CategoryDiff>;
  for (const c of categories) {
    totals[c] = {
      sizeBefore: 0,
      sizeAfter: 0,
      sizeDelta: 0,
      gzipBefore: 0,
      gzipAfter: 0,
      gzipDelta: 0,
      countBefore: 0,
      countAfter: 0,
    };
  }
  return totals;
}

export function diffSnapshots(
  base: Readonly<BundleSnapshot>,
  head: Readonly<BundleSnapshot>,
): BundleDiff {
  const baseFilesMap = buildLookupMap(base.files);
  const headFilesMap = buildLookupMap(head.files);

  const allKeys = new Set([...baseFilesMap.keys(), ...headFilesMap.keys()]);

  const files: FileDiff[] = [];
  const byCategory = emptyCategoryDiffs();
  let runtimeSizeBefore = 0;
  let runtimeSizeAfter = 0;
  let runtimeGzipBefore = 0;
  let runtimeGzipAfter = 0;

  for (const key of allKeys) {
    const prev = baseFilesMap.get(key);
    const curr = headFilesMap.get(key);
    const changeType = categorize(prev, curr);

    const file = (curr ?? prev) as FileEntry;
    const sizeBefore = prev?.size ?? 0;
    const sizeAfter = curr?.size ?? 0;
    const gzipBefore = prev?.gzipSize ?? 0;
    const gzipAfter = curr?.gzipSize ?? 0;

    const fileDiff: FileDiff = {
      logicalPath: file.logicalPath,
      category: file.category,
      changeType,
      sizeBefore,
      sizeAfter,
      sizeDelta: sizeAfter - sizeBefore,
      gzipBefore,
      gzipAfter,
      gzipDelta: gzipAfter - gzipBefore,
      pathBefore: prev?.path,
      pathAfter: curr?.path,
    };

    files.push(fileDiff);

    // Aggregate into per-category totals
    const cat = byCategory[file.category];
    cat.sizeBefore += sizeBefore;
    cat.sizeAfter += sizeAfter;
    cat.sizeDelta += fileDiff.sizeDelta;
    cat.gzipBefore += gzipBefore;
    cat.gzipAfter += gzipAfter;
    cat.gzipDelta += fileDiff.gzipDelta;
    if (prev) cat.countBefore += 1;
    if (curr) cat.countAfter += 1;

    // Aggregate runtime totals (skip source maps — they're debug artifacts)
    const kind: FileKind =
      file.category === "sourcemap" ? "sourcemap" : "runtime";
    if (kind === "runtime") {
      runtimeSizeBefore += sizeBefore;
      runtimeSizeAfter += sizeAfter;
      runtimeGzipBefore += gzipBefore;
      runtimeGzipAfter += gzipAfter;
    }
  }

  files.sort((a, b) => Math.abs(b.gzipDelta) - Math.abs(a.gzipDelta));

  return {
    base: { capturedAt: base.capturedAt, buildDir: base.buildDir },
    head: { capturedAt: head.capturedAt, buildDir: head.buildDir },
    totals: {
      sizeBefore: runtimeSizeBefore,
      sizeAfter: runtimeSizeAfter,
      sizeDelta: runtimeSizeAfter - runtimeSizeBefore,
      gzipBefore: runtimeGzipBefore,
      gzipAfter: runtimeGzipAfter,
      gzipDelta: runtimeGzipAfter - runtimeGzipBefore,
    },
    byCategory,
    files,
  };
}
