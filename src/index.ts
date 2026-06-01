#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import { registerReviewCommand } from "./commands/review";
import { registerSnapshotCommand } from "./commands/snapshot";
import { registerDiffCommand } from "./commands/diff";

// Exit cleanly when downstream pipes close (e.g. `... | head`, `... | jq` errors).
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

registerSnapshotCommand(program);
registerDiffCommand(program);
registerReviewCommand(program);

program.parseAsync().catch((err) => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});
