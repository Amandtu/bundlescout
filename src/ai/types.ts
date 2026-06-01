import type Anthropic from "@anthropic-ai/sdk";

// The structured review the LLM must return.
// Keep this in sync with REVIEW_TOOL_SCHEMA below.
export type BundleReview = {
  classification: ReviewClassification;
  severity: ReviewSeverity;
  confidence: ReviewConfidence;
  root_cause: string;
  analysis: string;
  suggestions: ReviewSuggestion[];
  should_flag_for_review: boolean;
};

export type ReviewClassification =
  | "noise"
  | "necessary_growth"
  | "bloat"
  | "refactor"
  | "regression";

export type ReviewSeverity = "none" | "low" | "medium" | "high";

export type ReviewConfidence = "low" | "medium" | "high";

export type ReviewSuggestion = {
  suggestion: string;
  estimated_impact?: string;
};

export const BUNDLE_REVIEW_TOOL_NAME = "submit_bundle_review" as const;

/**
 * Tool schema sent to Claude. The `description` fields on each property
 * are doing real prompt work — they spell out the decision criteria for
 * each enum value so the model picks the right one. Treat edits here as
 * prompt edits, not just documentation.
 */
export const REVIEW_TOOL_SCHEMA: Anthropic.Tool = {
  name: BUNDLE_REVIEW_TOOL_NAME,
  description:
    "Submit a structured review of a frontend bundle diff. Call this exactly once with your final assessment. Do not return prose outside the tool call.",
  input_schema: {
    type: "object",
    properties: {
      classification: {
        type: "string",
        enum: ["noise", "necessary_growth", "bloat", "refactor", "regression"],
        description: [
          "What kind of change this is. Pick the single best fit:",
          "- 'noise': sub-KB net change, expected churn (hash renames, minor minifier output drift). No action needed.",
          "- 'necessary_growth': size increased but the diff suggests a legitimate cause (new feature code, intentional dependency add). Use this when the cost looks proportional to value, even though you can't see the PR description.",
          "- 'bloat': size increased without clear justification. Signals: a large dependency added for what looks like a small use case, duplicate libraries, an unexpectedly large vendor chunk, or many small files added with no obvious cohesion.",
          "- 'refactor': files were renamed, split, or reorganized but net size is roughly neutral. Top changes will often show large negatives and positives that cancel out.",
          "- 'regression': something looks broken or unexpectedly worse — sourcemaps shipped to prod, a chunk that should be lazy in the main bundle, gzip ratio collapsed, an asset category exploded.",
        ].join("\n"),
      },
      severity: {
        type: "string",
        enum: ["none", "low", "medium", "high"],
        description: [
          "How much a reviewer should care. Calibrate against typical frontend PRs, not absolute bytes:",
          "- 'none': noise-class changes, nothing to discuss.",
          "- 'low': worth a comment but not blocking. Small unjustified growth, minor inefficiencies.",
          "- 'medium': should be discussed before merge. Notable growth, suspicious dependency add, possible duplication.",
          "- 'high': should not merge without investigation. Large unexplained growth, likely regression, sourcemaps in prod, main bundle ballooning.",
          "Be willing to use 'none' and 'low'. Most PRs are not high-severity.",
        ].join("\n"),
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: [
          "How sure you are in the classification and severity, given that you only see the diff (no source, no PR description, no package.json):",
          "- 'low': the diff is ambiguous; multiple plausible explanations.",
          "- 'medium': one explanation is clearly more likely than others, but you're inferring.",
          "- 'high': the diff itself is strong evidence (e.g. a 500KB file named 'vendor-moment.js' was added).",
          "Prefer 'low' or 'medium' when you're speculating. Overconfident reviews are worse than hedged ones.",
        ].join("\n"),
      },
      root_cause: {
        type: "string",
        description:
          "One or two sentences identifying the most likely cause of the change, grounded in specific files or categories from the diff. Reference filenames or category totals where possible. If the cause is unclear, say so plainly rather than guessing.",
      },
      analysis: {
        type: "string",
        description:
          "A short paragraph (roughly 80–120 words) explaining your reasoning: what the diff shows, why you classified it the way you did, and what a reviewer should pay attention to. Cite specific numbers and filenames from the diff. Avoid generic advice that would apply to any PR.",
      },
      suggestions: {
        type: "array",
        description:
          "Concrete, actionable suggestions for the PR author or reviewer. Zero to three items. An empty array is correct when the change is noise or clearly fine — do not invent suggestions to fill space.",
        items: {
          type: "object",
          properties: {
            suggestion: {
              type: "string",
              description:
                "A specific, actionable suggestion. Prefer 'check whether X is dynamically importable' over 'consider code-splitting'.",
            },
            estimated_impact: {
              type: "string",
              description:
                "Optional. A rough estimate of the size impact if the suggestion is followed (e.g. '~40KB gzip saved'). Omit if you cannot ground the estimate in the diff.",
            },
          },
          required: ["suggestion"],
        },
      },
      should_flag_for_review: {
        type: "boolean",
        description:
          "True if a human reviewer should pause and look at this PR before approving. Generally true for severity 'medium' or 'high', or any 'regression' classification. False for noise and most necessary_growth cases.",
      },
    },
    required: [
      "classification",
      "severity",
      "confidence",
      "root_cause",
      "analysis",
      "suggestions",
      "should_flag_for_review",
    ],
  },
};
