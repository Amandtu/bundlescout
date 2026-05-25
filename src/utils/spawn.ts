import { execa, type Options as ExecaOptions } from "execa";
import chalk from "chalk";

export type SpawnOptions = {
  cwd: string;
  stream?: boolean;
};

export type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

/**
 * Run a shell command in a child process.
 *
 * Two modes:
 *   - Default: capture stdout/stderr silently, return them on success
 *   - stream=true: pipe live to user's terminal (for long-running commands)
 *
 * On non-zero exit, throws an Error with the command, cwd, and tail of stderr.
 */
export async function spawn(
  command: string,
  args: string[],
  opts: SpawnOptions,
): Promise<SpawnResult> {
  const execaOpts: ExecaOptions = {
    cwd: opts.cwd,
    stdio: opts.stream ? "inherit" : "pipe",
    reject: false,
    // shell: true is needed for yarn/corepack to find its dependencies the same way
    // a user terminal would. We control all inputs so the security implications are nil.
    shell: true,
  };

  if (opts.stream) {
    console.log(
      chalk.gray(`$ ${command} ${args.join(" ")}  (cwd: ${execaOpts.cwd})`),
    );
  }

  const result = await execa(command, args, execaOpts);

  //    Note: in stream mode, stderr won't be captured (it went to terminal).
  const stdout = asString(result.stdout);
  const stderr = asString(result.stderr);
  const exitCode = result.exitCode ?? -1;

  if (exitCode !== 0) {
    const stderrTail = stderr.split("\n").slice(-15).join("\n");
    throw new Error(
      `Command failed (exit ${exitCode}): ${command} ${args.join(" ")}\n` +
        `cwd: ${opts.cwd}\n\n` +
        `stderr (last 15 lines):\n${stderrTail}`,
    );
  }

  return { stdout, stderr, exitCode };
}
