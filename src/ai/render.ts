import chalk from "chalk";
import type { BundleReview } from "./types.js";

const SEVERITY_COLORS: Record<BundleReview["severity"], (s: string) => string> =
  {
    none: chalk.gray,
    low: chalk.green,
    medium: chalk.yellow,
    high: chalk.red,
  };

const CONFIDENCE_COLORS: Record<
  BundleReview["confidence"],
  (s: string) => string
> = {
  low: chalk.gray,
  medium: chalk.yellow,
  high: chalk.green,
};

const CLASSIFICATION_LABELS: Record<BundleReview["classification"], string> = {
  noise: "noise",
  necessary_growth: "necessary growth",
  bloat: "bloat",
  refactor: "refactor",
  regression: "regression",
};

export function printAIReview(
  review: BundleReview,
  meta: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    inputCostPerMillion: number; // USD per million tokens
    outputCostPerMillion: number;
  },
): void {
  const classification = CLASSIFICATION_LABELS[review.classification];
  const severity = SEVERITY_COLORS[review.severity](
    `${review.severity} severity`,
  );
  const confidence = CONFIDENCE_COLORS[review.confidence](
    `${review.confidence} confidence`,
  );

  console.log(chalk.bold.cyan(`\n=== AI Review ===\n`));

  console.log(
    `${chalk.bold("Classification:")} ${chalk.bold(classification)}  ` +
      `(${severity}, ${confidence})`,
  );

  if (review.should_flag_for_review) {
    console.log(`${chalk.bold("Flagged for review:")} ${chalk.yellow("yes")}`);
  } else {
    console.log(`${chalk.bold("Flagged for review:")} ${chalk.gray("no")}`);
  }

  console.log();
  console.log(chalk.bold("Root cause:"));
  console.log(wrap(review.root_cause, 78));

  console.log();
  console.log(chalk.bold("Analysis:"));
  console.log(wrap(review.analysis, 78));

  if (review.suggestions.length > 0) {
    console.log();
    console.log(chalk.bold("Suggestions:"));
    review.suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${wrap(s.suggestion, 75, "     ")}`);
      if (s.estimated_impact) {
        console.log(
          chalk.gray(
            `     Impact: ${wrap(s.estimated_impact, 70, "             ")}`,
          ),
        );
      }
    });
  }

  const cost =
    (meta.inputTokens * meta.inputCostPerMillion +
      meta.outputTokens * meta.outputCostPerMillion) /
    1_000_000;

  console.log();
  console.log(chalk.gray("─".repeat(78)));
  console.log(
    chalk.gray(
      `AI-generated analysis using ${meta.model}. Verify against the diff data above.`,
    ),
  );
  console.log(
    chalk.gray(
      `Tokens: ${meta.inputTokens.toLocaleString()} in / ${meta.outputTokens.toLocaleString()} out  ` +
        `(~$${cost.toFixed(4)})`,
    ),
  );
  console.log();
}

/**
 * Wrap a long string to a max line width, with optional indentation for continuation lines.
 * Simple word-based wrapping — fine for prose, doesn't handle code/markdown specially.
 */
function wrap(text: string, width: number, continuationIndent = ""): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  return lines
    .map((line, i) => (i === 0 ? line : `${continuationIndent}${line}`))
    .join("\n");
}
