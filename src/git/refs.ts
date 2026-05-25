import { spawn } from "../utils/spawn";

export async function assertGitRepo(repoPath: string): Promise<void> {
  try {
    await spawn("git", ["rev-parse", "--git-dir"], {
      cwd: repoPath,
    });
  } catch {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

export async function resolveRef(
  repoPath: string,
  ref: string,
): Promise<string> {
  try {
    const result = await spawn(
      "git",
      ["rev-parse", "--verify", `${ref}^{commit}`],
      { cwd: repoPath },
    );
    return result.stdout.trim();
  } catch {
    throw new Error(
      `Git ref not found: "${ref}"\n` +
        `Make sure the branch, tag, or commit exists in ${repoPath}.\n` +
        `Debug: git -C ${repoPath} rev-parse ${ref}`,
    );
  }
}
