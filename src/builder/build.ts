import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "../utils/spawn";
import chalk from "chalk";

export type BuildConfig = {
  installCmd: string[];
  buildCmd: string[];
  buildDir: string;
};

export async function runBuild(
  worktreePath: string,
  config: BuildConfig,
): Promise<string> {
  const [installBin, ...installArgs] = config.installCmd;
  console.log(chalk.bold("Installing..."));
  await spawn(installBin, installArgs, { cwd: worktreePath, stream: true });

  const [buildBin, ...buildArgs] = config.buildCmd;
  console.log(chalk.bold("Building..."));
  await spawn(buildBin, buildArgs, { cwd: worktreePath, stream: true });

  const buildPath = path.resolve(worktreePath, config.buildDir);
  const stat = await fs.stat(buildPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(
      `Build completed but output directory not found: ${buildPath}\n` +
        `Check that --build-dir matches what your build command produces.`,
    );
  }

  return buildPath;
}
