import chalk from "chalk";
import type { Command } from "commander";

import { assertGitRepo, resolveRef } from "../git/refs.js";
import {
  createWorktree,
  pruneStaleWorktrees,
  type Worktree,
} from "../git/worktree.js";
import { runBuild, type BuildConfig } from "../builder/build.js";
import { captureSnapshot } from "../bundle/stats.js";
import { diffSnapshots } from "../bundle/diff.js";
import { printDiffSummary } from "./diff.js";
import { reviewBundleDiff } from "../ai/review.js";
import { printAIReview } from "../ai/render.js";

type ReviewOptions = {
  repo: string;
  base: string;
  head: string;
  installCmd: string;
  buildCmd: string;
  buildDir: string;
  json?: boolean;
  top: string;
  showUnchanged?: boolean;
  showSourcemaps?: boolean;
  withAi?: boolean;
};

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Build two refs and diff their bundles end-to-end")
    .requiredOption("--repo <path>", "Path to the git repository")
    .requiredOption("--base <ref>", "Base ref (branch, commit, or tag)")
    .requiredOption("--head <ref>", "Head ref (branch, commit, or tag)")
    .option("--install-cmd <cmd>", "Install command", "yarn install")
    .option("--build-cmd <cmd>", "Build command", "yarn build:app")
    .option(
      "--build-dir <path>",
      "Build output dir (relative to repo root)",
      "excalidraw-app/build",
    )
    .option("--json", "Output JSON")
    .option("--top <n>", "Top N file changes", "20")
    .option("--show-unchanged", "Include unchanged files in output", false)
    .option(
      "--show-sourcemaps",
      "Include source maps in file change list",
      false,
    )
    .option(
      "--with-ai",
      "Run AI analysis on the bundle diff after computing it",
      false,
    )
    .action(async (opts: ReviewOptions) => {
      // ── 1. Validate inputs ───────────────────────────────────────────────
      // - Call assertGitRepo on opts.repo
      // - Best-effort: pruneStaleWorktrees on opts.repo
      // - Resolve both refs to full SHAs using resolveRef
      //   (resolving early catches typos before we spend 5 min on builds)
      // TODO

      await assertGitRepo(opts.repo);
      await pruneStaleWorktrees(opts.repo);
      const baseSha = await resolveRef(opts.repo, opts.base);
      const headSha = await resolveRef(opts.repo, opts.head);

      // ── 2. Print a header so the user knows what's about to happen ───────
      // Something like:
      //   Base: master (5a3b8d12)
      //   Head: feature-branch (9c2f4e67)
      // Use chalk.bold. Show the first 8 chars of each SHA.
      // TODO
      console.log(chalk.bold(`Base: ${opts.base} (${baseSha.slice(0, 7)})`));
      console.log(chalk.bold(`Head: ${opts.head} (${headSha.slice(0, 7)})`));

      // ── 3. Build BuildConfig from CLI options ────────────────────────────
      // - Split installCmd and buildCmd strings on whitespace (/\s+/)
      // - buildDir passes through as-is
      // TODO
      const buildConfig: BuildConfig = {
        installCmd: opts.installCmd.split("/\s+/"),
        buildCmd: opts.buildCmd.split("//\s+"),
        buildDir: opts.buildDir,
      };

      // ── 4. Track worktrees in scope-level variables so finally can see them
      //     Initialize them as null. We assign them after createWorktree.
      let baseWT: Worktree | null = null;
      let headWT: Worktree | null = null;

      try {
        // ── 5. Build base ──────────────────────────────────────────────────
        // - Print a section header like "=== Building base (<ref>) ===" in chalk.bold.cyan
        // - createWorktree → assign to baseWT
        // - runBuild on baseWT.path → get baseBuildPath
        // - captureSnapshot on baseBuildPath → baseSnapshot
        // TODO
        console.log(chalk.bold.cyan(`=== Building base (${opts.base}) ===`));
        baseWT = await createWorktree(opts.repo, baseSha);
        const baseBuildPath = await runBuild(baseWT.path, buildConfig);
        const baseSnapshot = await captureSnapshot(baseBuildPath);

        // ── 6. Build head ──────────────────────────────────────────────────
        // Same pattern as base, but for head
        // TODO
        console.log(chalk.bold.cyan(`=== Building head (${opts.head}) ===`));
        headWT = await createWorktree(opts.repo, headSha);
        const headBuildPath = await runBuild(headWT.path, buildConfig);
        const headSnapshot = await captureSnapshot(headBuildPath);

        // ── 7. Diff and print ──────────────────────────────────────────────
        // - Call diffSnapshots(baseSnapshot, headSnapshot) → diff
        // - Print "=== Result ===" header
        // - If opts.json: JSON.stringify the diff and console.log it
        // - Else: call printDiffSummary(diff, { top: opts.top, showUnchanged: opts.showUnchanged })
        // TODO
        const diff = diffSnapshots(baseSnapshot, headSnapshot);
        let aiResult: Awaited<ReturnType<typeof reviewBundleDiff>> | null =
          null;
        if (opts.withAi) {
          console.log(chalk.gray("\nCalling Claude for analysis..."));
          aiResult = await reviewBundleDiff({
            diff,
            baseRef: opts.base,
            baseSha,
            headRef: opts.head,
            headSha,
          });
        }

        console.log(chalk.bold.cyan("=== Result ==="));

        if (opts.json) {
          const out = aiResult
            ? { diff, ai: aiResult.review, usage: aiResult.usage }
            : { diff };
          console.log(JSON.stringify(out, null, 2));
        } else {
          printDiffSummary(diff, {
            top: opts.top,
            showUnchanged: opts.showUnchanged,
            showSourcemaps: opts.showSourcemaps,
            labels: {
              base: `${opts.base} (${baseSha.slice(0, 7)})`,
              head: `${opts.head} (${headSha.slice(0, 7)})`,
            },
          });
          if (aiResult) {
            printAIReview(aiResult.review, {
              model: "claude-sonnet-4-6",
              inputTokens: aiResult.usage.inputTokens,
              outputTokens: aiResult.usage.outputTokens,
              inputCostPerMillion: 3,
              outputCostPerMillion: 15,
            });
          }
        }
      } finally {
        // ── 8. Always clean up worktrees ───────────────────────────────────
        // - If baseWT exists, await its cleanup (with .catch that warns but doesn't throw)
        // - Same for headWT
        // - Why both: if base build succeeded but head build failed, baseWT exists too
        // - Why .catch: we're in finally because something already failed (maybe);
        //   we must not let cleanup errors mask the original error
        // TODO
        await baseWT?.cleanup().catch((err) => {
          console.warn(chalk.yellow(`Base cleanup failed: ${err.message}`));
        });

        await headWT?.cleanup().catch((err) => {
          console.warn(chalk.yellow(`Head cleanup failed: ${err.message}`));
        });
      }
    });
}
