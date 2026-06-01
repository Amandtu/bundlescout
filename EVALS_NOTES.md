# Eval Notes

Observed failure modes and calibration findings from Week 2 manual
testing. Each item is labeled with what to measure in Week 3's eval
harness.

---

## Test cases run

| #   | Refs                                                  | Bundle delta (gzip) | AI classification | AI confidence |
| --- | ----------------------------------------------------- | ------------------- | ----------------- | ------------- |
| 1   | master~50 → master                                    | +114 KB             | necessary_growth  | medium        |
| 2   | master~3 → master                                     | +476 B              | noise             | high          |
| 3   | master~100 → master                                   | -97 KB              | refactor          | high          |
| 4   | a0b98a94~1 → a0b98a94 (PR #10530, "TextToDiagram v2") | -240 KB             | refactor          | high          |

---

## Failure mode 1: Causation overreach

When the model sees two events occur simultaneously (e.g. a new chunk
appears + the main bundle grows), it consistently links them causally
without proof.

### Observed across three tests

- **Test 1** (50 commits): "A 51KB increase in index.js coinciding with
  a new codemirror chunk is suspicious." Then suggested: "Verify that
  index.js does not also contain a duplicate copy of CodeMirror code."
- **Test 3** (100 commits): "Some code previously in the removed chunks
  may have been inlined into the main bundle."
- **Test 4** (one PR): "Verify that index.js growth wasn't accidentally
  inlined into the main entry point."

### Confirmed false alarm

For Test 4, the index.js growth is from the NEW TextToDiagram v2 feature
code itself — not accidental inlining. The model's suggestion would have
sent a reviewer chasing a phantom.

### Why it matters

If the model raises this concern often and it's wrong most of the time,
reviewers stop trusting the bot. False alarms erode trust over time.

### Eval question (Week 3)

For each labeled PR where the model flags potential "index.js inlining":

- Verify against the actual code diff: was content actually inlined
  that should have been lazy?
- Score true positives vs false positives

**Hypothesis to test:** Model flags this in 30-50% of multi-event diffs,
but actual inlining occurs in <10% of those cases. Need measurement.

---

## Failure mode 2: Classification ambiguity (without PR context)

Same bundle delta can legitimately be classified differently depending
on whether you have PR-level context.

### Test 4 case

PR #10530 ("TextToDiagram v2") shows up in the bundle as chunk
restructuring with a -240KB gzip net reduction. The AI correctly
classified this as `refactor`.

But the PR title says it's a feature: TextToDiagram v2. A human reviewer
seeing the PR title would call this `necessary_growth` (new feature) with
positive side effects (bundle reduction).

### The trade-off

- AI sees only the bundle → reasonable to call it `refactor`
- Human sees PR title → would call it a feature add
- Neither is "wrong" — they're answering different questions

### Eval implication

For each labeled PR, capture TWO classifications:

- **Without PR context**: what would the model see (or a human looking
  only at the bundle)
- **With PR context**: what a human reviewer with the full PR knows

If we want the model to match "with context" classifications, we need to
feed it more context (PR title at minimum, package.json diff possibly).

This revisits the Q2 decision from Week 2 planning, where we deferred
package.json diff. The TextToDiagram v2 case suggests the deferral might
have been too aggressive for cases with significant non-dependency changes.

### Eval question (Week 3)

After running the model with and without PR title in the prompt:

- Does classification accuracy improve when PR title is included?
- By how much?
- Does it introduce new failure modes (e.g. over-trusting the title)?

---

## Calibration win 1: Noise detection

Test 2 (master~3 → master) correctly classified as `noise`, `none` severity,
`high` confidence. Net runtime delta was +476 bytes gzip — well inside the
±2 KB threshold.

The model didn't get fooled by the top-N file list (which showed scary-looking
adds of ~1.98 MB) and correctly identified them as hash-rotation pairs that
cancel out.

### Eval value

Keep as a labeled "true negative" example. A model that over-flags will fail
this. Distinguishing "looks scary in top-N but cancels out" from "real growth"
is one of the most important calibration dimensions.

---

## Calibration win 2: Refactor recognition

Test 3 (100 commits) and Test 4 (1 PR) both correctly classified as `refactor`
with high confidence. The model:

- Recognized chunk renaming patterns (old monolithic chunks dissolved,
  new specifically-named chunks introduced)
- Inferred library identities from chunk names (cytoscape, cose-bilkent
  are real Mermaid graph-layout deps — confirmed)
- Inferred dependency version bump from naming changes — and Test 4's
  ground truth confirmed this exact bump happened (mermaid-to-excalidraw v1
  → v2)

### Eval value

Strong signal that the model can read meaningful structure from chunk names
when they're not generic. Worth labeling these as positive examples of
"inference from chunk names" — separate from causation overreach (which is
inference FROM CO-OCCURRENCE).

---

## Calibration win 3: Skepticism posture works

After we added the "Skepticism is your job" section to the system prompt,
Test 1's analysis got sharper:

- Before: "without more context, this is suspicious"
- After: "this cannot be classified as necessary growth"

The change in framing came from prompt engineering, not model retraining.
Worth keeping the strict framing as a baseline — and revisiting if false
alarms (Failure mode 1) become a measured problem.

---

## Other observations worth tracking

### Cost trim worked with no quality loss

Reducing input tokens 9× (106k → 11k) by sending only top-50 changed files
and dropping unchanged entries produced equivalent-quality reviews. Cost
dropped from $0.33 to $0.045 per review.

### Source maps correctly handled

The model consistently treats source maps as debug-only and uses their
deltas only as supporting evidence (e.g. "source map also grew, suggesting
real code added"). The prompt instruction to ignore them for primary
analysis is working.

### Hash-rotation pairs correctly recognized

The model recognizes `index-ABC.js` removed + `index-DEF.js` added with
the same base name as a hash rotation (single modification) rather than
two separate events. Critical for noise detection.

---

## Week 3 plan implications

Based on these observations, the Week 3 eval harness should:

1. **Build a dataset of 30+ labeled Excalidraw PRs** spanning all five
   classifications (noise, necessary_growth, bloat, refactor, regression)

2. **Label each PR with two classifications**: with-context and
   without-context. Lets us measure the marginal value of context.

3. **For each PR, label specific claims** the model might make:
   - Was the stated root cause correct?
   - Did the model suggest "index.js inlining"? If yes, was it actually
     happening?
   - Did the model name any library? If yes, was the named library actually
     involved?

4. **Score multiple dimensions per review**:
   - Classification correctness (with vs without context)
   - Causation accuracy (false-positive rate on stated causes)
   - Suggestion quality (testable / specific vs generic)
   - Confidence calibration (is `confidence: high` actually more accurate?)

5. **Once eval baseline is established, test prompt variants**:
   - With PR title in user prompt
   - With package.json diff in user prompt
   - With weaker skepticism posture (to check if false alarms drop)
   - With different models (Sonnet 4.6 vs Opus 4.6 vs Haiku 4.5)
