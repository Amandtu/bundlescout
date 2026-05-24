import chalk from "chalk";
import type { Command } from "commander";
import { captureSnapshot } from "../bundle/stats.js";
import { diffSnapshots } from "../bundle/diff.js";
import type { BundleDiff, FileCategory, FileDiff } from "../types.js";
import { formatBytes, formatDelta, formatPercent } from "../utils/format.js";

type DiffOptions = {
  json?: boolean;
  top: string;
  showUnchanged?: boolean;
};

const CATEGORY_LABELS: Record<FileCategory, { label: string; note?: string }> =
  {
    js: { label: "JS" },
    css: { label: "CSS" },
    font: { label: "Fonts", note: "already compressed" },
    image: { label: "Images", note: "already compressed" },
    sourcemap: { label: "Source maps", note: "debug only" },
    other: { label: "Other" },
  };

const CHANGE_MARKERS: Record<
  FileDiff["changeType"],
  { marker: string; label: string }
> = {
  added: { marker: "+", label: "ADDED" },
  removed: { marker: "-", label: "REMOVED" },
  modified: { marker: "~", label: "MODIFIED" },
  unchanged: { marker: "=", label: "UNCHANGED" },
};

/**
 * Colour a delta: growth → yellow, shrink → green, zero → gray.
 * Added/removed files override (green/red).
 */
function colourForChange(change: FileDiff): (s: string) => string {
  switch (change.changeType) {
    case "added":
      return chalk.green;
    case "removed":
      return chalk.red;
    case "unchanged":
      return chalk.gray;
    case "modified":
      if (change.gzipDelta > 0) return chalk.yellow;
      if (change.gzipDelta < 0) return chalk.green;
      return chalk.gray;
  }
}

function printSummary(diff: BundleDiff, opts: DiffOptions): void {
  const top = parseInt(opts.top, 10);

  console.log(chalk.bold(`\nDiff: ${diff.base.buildDir}`));
  console.log(chalk.bold(`  →   ${diff.head.buildDir}\n`));

  // Totals
  const { totals } = diff;
  const rawLine = `${formatBytes(totals.sizeBefore)} → ${formatBytes(totals.sizeAfter)}`;
  const gzipLine = `${formatBytes(totals.gzipBefore)} → ${formatBytes(totals.gzipAfter)}`;
  const rawDelta = chalk.cyan(formatDelta(totals.sizeDelta).padStart(10));
  const gzipDelta = chalk.cyan(formatDelta(totals.gzipDelta).padStart(10));
  const rawPct = chalk.gray(
    `(${formatPercent(totals.sizeDelta, totals.sizeBefore)})`,
  );
  const gzipPct = chalk.gray(
    `(${formatPercent(totals.gzipDelta, totals.gzipBefore)})`,
  );

  console.log(`Total runtime:  ${rawLine.padEnd(28)}  ${rawDelta}  ${rawPct}`);
  console.log(
    `Total gzip:     ${gzipLine.padEnd(28)}  ${gzipDelta}  ${gzipPct}`,
  );

  // By-category
  console.log(chalk.bold(`\nBy category (gzip delta):`));
  for (const [cat, c] of Object.entries(diff.byCategory)) {
    if (c.countBefore === 0 && c.countAfter === 0) continue;
    const { label, note } = CATEGORY_LABELS[cat as FileCategory];

    const sizeLine = `${formatBytes(c.gzipBefore)} → ${formatBytes(c.gzipAfter)}`;
    const delta = formatDelta(c.gzipDelta).padStart(10);
    const colour =
      c.gzipDelta > 0
        ? chalk.yellow
        : c.gzipDelta < 0
          ? chalk.green
          : chalk.gray;
    const pct = chalk.gray(`(${formatPercent(c.gzipDelta, c.gzipBefore)})`);
    const counts =
      c.countBefore === c.countAfter
        ? chalk.gray(`(${c.countAfter} files)`)
        : chalk.gray(`(${c.countBefore} → ${c.countAfter} files)`);
    const noteText = note ? chalk.gray(`  ${note}`) : "";

    console.log(
      `  ${label.padEnd(13)} ${sizeLine.padEnd(22)}  ${colour(delta)}  ${pct}  ${counts}${noteText}`,
    );
  }

  // Top N file changes
  const changedOnly = opts.showUnchanged
    ? diff.files
    : diff.files.filter((f) => f.changeType !== "unchanged");

  if (changedOnly.length === 0) {
    console.log(chalk.gray(`\nNo file changes.\n`));
    return;
  }

  console.log(
    chalk.bold(
      `\nTop ${Math.min(top, changedOnly.length)} file changes (by gzip delta):`,
    ),
  );

  for (const f of changedOnly.slice(0, top)) {
    const { marker, label } = CHANGE_MARKERS[f.changeType];
    const colour = colourForChange(f);

    const rawCol = formatDelta(f.sizeDelta).padStart(10);
    const gzipCol = formatDelta(f.gzipDelta).padStart(10);
    const sizeContext =
      f.changeType === "modified"
        ? chalk.gray(
            `(${formatBytes(f.sizeBefore)} → ${formatBytes(f.sizeAfter)})`,
          )
        : "";

    console.log(
      `  ${colour(marker)} ${colour(rawCol)} / ${colour(gzipCol)}  ${colour(label.padEnd(9))}  ${f.logicalPath}  ${sizeContext}`,
    );
  }
  console.log();
}

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Diff two bundle builds (base vs head)")
    .argument("<base-build-dir>", "Path to the base build output")
    .argument("<head-build-dir>", "Path to the head build output")
    .option("--json", "Output as JSON instead of a human-readable summary")
    .option("--top <n>", "Show top N file changes", "20")
    .option("--show-unchanged", "Include unchanged files in output", false)
    .action(async (baseDir: string, headDir: string, opts: DiffOptions) => {
      const [base, head] = await Promise.all([
        captureSnapshot(baseDir),
        captureSnapshot(headDir),
      ]);

      const diff = diffSnapshots(base, head);

      if (opts.json) {
        console.log(JSON.stringify(diff, null, 2));
        return;
      }

      printSummary(diff, opts);
    });
}
