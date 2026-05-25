import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import { spawn } from "../utils/spawn";

export type Worktree = {
  path: string;
  ref: string;
  cleanup: () => Promise<void>;
};

export async function createWorktree(
  repoPath: string,
  ref: string,
): Promise<Worktree> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bundlescout-"));
  const worktreePath = path.join(dir, "worktree");

  async function cleanup() {
    try {
      await spawn("git", ["worktree", "remove", "--force", worktreePath], {
        cwd: repoPath,
      });
    } catch (err) {
      console.warn(
        chalk.yellow(`worktree remove failed: ${(err as Error).message}`),
      );
    }

    await fs.rm(dir, { recursive: true, force: true });
  }

  console.log(chalk.gray("Creating worktree..."));
  await spawn(
    "git",
    ["worktree", "add", "--detach", "--force", worktreePath, ref],
    { cwd: repoPath },
  );

  return { path: worktreePath, ref, cleanup };
}

export async function pruneStaleWorktrees(repoPath: string): Promise<void> {
  try {
    await spawn("git", ["worktree", "prune"], { cwd: repoPath });
  } catch {}
}
