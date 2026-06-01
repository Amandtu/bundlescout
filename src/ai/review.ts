import Anthropic from "@anthropic-ai/sdk";
import type { BundleDiff } from "../types.js";
import type { BundleReview } from "./types.js";
import { REVIEW_TOOL_SCHEMA } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export type ReviewResult = {
  review: BundleReview;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

const FILES_TO_SEND = 50;

function prepareDiffForAI(diff: BundleDiff) {
  const changedFiles = diff.files.filter((f) => f.changeType !== "unchanged");
  const topFiles = changedFiles.slice(0, FILES_TO_SEND);
  return {
    ...diff,
    files: topFiles,
    files_omitted_count: changedFiles.length - topFiles.length,
  };
}

export async function reviewBundleDiff(params: {
  diff: BundleDiff;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  model?: string; // default: claude-sonnet-4-6
}): Promise<ReviewResult> {
  const client = new Anthropic();

  const userPrompt = buildUserPrompt({
    baseRef: params.baseRef,
    baseSha: params.baseSha,
    headRef: params.headRef,
    headSha: params.headSha,
    diff: prepareDiffForAI(params.diff),
  });

  const response = await client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [REVIEW_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: REVIEW_TOOL_SCHEMA.name },
    messages: [{ role: "user", content: userPrompt }],
  });

  // Find the tool_use block. With tool_choice forcing it, there should be exactly one.
  const toolUseBlock = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use" && block.name === REVIEW_TOOL_SCHEMA.name,
  );

  if (!toolUseBlock) {
    throw new Error(
      `Expected a tool_use block in the response, got: ${JSON.stringify(response.content, null, 2)}`,
    );
  }

  // The tool input is typed as `unknown` by the SDK because it can't know the schema.
  // We trust the schema enforcement here. In Week 3, evals will catch any drift.
  const review = toolUseBlock.input as BundleReview;

  return {
    review,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
