#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { captureSnapshot } from "./bundle/stats.js";
import { formatBytes } from "./utils/format.js";

process.stdout.on("error", (err) => {
  if ((err as NodeJS.ErrnoException).code === "EPIPE") {
    process.exit(0);
  }
  throw err;
});

const program = new Command();

program
  .name("bundlescout")
  .description("AI-powered bundle-size reviewer for pull requests")
  .version("0.0.1");

program
  .command("snapshot")
  .description("Capture a bundle snapshot from a build directory")
  .argument("<build-dir>", "Path to the build output directory")
  .option("--json", "Output as JSON instead of a human-readable summary")
  .option("--top <n>", "Show top N largest files in summary", "15")
  .action(async (buildDir: string, opts: { json?: boolean; top: string }) => {
    const snapshot = await captureSnapshot(buildDir);

    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }

    const top = parseInt(opts.top, 10);
    console.log(chalk.bold(`\nBundle snapshot: ${snapshot.buildDir}`));
    console.log(chalk.gray(`Captured: ${snapshot.capturedAt}\n`));
    console.log(`Files:        ${snapshot.files.length}`);
    console.log(
      `Total size:   ${chalk.cyan(formatBytes(snapshot.totalSize))}  ` +
        chalk.gray(`(${formatBytes(snapshot.totalSizeAll)} with maps)`),
    );
    console.log(
      `Total gzip:   ${chalk.cyan(formatBytes(snapshot.totalGzipSize))}  ` +
        chalk.gray(`(${formatBytes(snapshot.totalGzipSizeAll)} with maps)`),
    );

    // By-category breakdown
    const labels: Record<string, { label: string; note?: string }> = {
      js: { label: "JS" },
      css: { label: "CSS" },
      font: { label: "Fonts", note: "already compressed" },
      image: { label: "Images", note: "already compressed" },
      sourcemap: { label: "Source maps", note: "debug only" },
      other: { label: "Other" },
    };

    console.log(chalk.bold(`\nBy category (raw / gzip):`));
    for (const [cat, stats] of Object.entries(snapshot.byCategory)) {
      if (stats.count === 0) continue;
      const { label, note } = labels[cat];
      const raw = formatBytes(stats.size).padStart(10);
      const gz = formatBytes(stats.gzipSize).padStart(10);
      const fileText = `(${stats.count} file${stats.count === 1 ? "" : "s"})`;
      const noteText = note ? chalk.gray(`  ${note}`) : "";
      console.log(
        `  ${label.padEnd(12)} ${chalk.cyan(raw)} / ${chalk.cyan(gz)}  ${chalk.gray(fileText)}${noteText}`,
      );
    }

    console.log(chalk.bold(`Top ${top} largest files:`));
    snapshot.files.slice(0, top).forEach((f) => {
      const size = formatBytes(f.size).padStart(10);
      const gzip = formatBytes(f.gzipSize).padStart(10);
      console.log(`  ${chalk.gray(size)}  ${chalk.gray(gzip)}  ${f.path}`);
    });
    console.log();
  });

program.parseAsync().catch((err) => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});
