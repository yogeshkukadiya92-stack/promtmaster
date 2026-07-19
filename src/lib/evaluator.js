const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function evaluateAsset(asset) {
  if (!asset) return null;
  const sectionCount = asset.sections?.length || 0;
  const contentLength = asset.sections?.reduce((total, section) => total + section.content.length, 0) || 0;
  const hasApproval = asset.sections?.some((section) => /approval|guardrail|constraint|quality/i.test(`${section.label} ${section.content}`));
  const hasOutput = asset.sections?.some((section) => /output|deliverable|result/i.test(`${section.label} ${section.content}`));

  const dimensions = [
    { label: "Clarity", score: clamp(76 + Math.min(asset.title.length, 40) / 4) },
    { label: "Context", score: clamp(68 + (asset.context?.length || 0) * 6) },
    { label: "Completeness", score: clamp(58 + sectionCount * 8 + (hasOutput ? 8 : 0)) },
    { label: "Reliability", score: clamp(64 + (hasApproval ? 14 : 0) + Math.min(contentLength / 100, 12)) },
  ];
  const overall = clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const suggestions = [];
  if (!hasOutput) suggestions.push("Add a stricter output or deliverables section.");
  if (!hasApproval) suggestions.push("Add constraints, guardrails, or a human-approval checkpoint.");
  if (sectionCount < 5) suggestions.push("Add examples and edge-case handling for more reliable reuse.");
  if (!suggestions.length) suggestions.push("Add two representative test cases before production use.");

  return { overall, dimensions, suggestions };
}

export async function runAssetTest(asset, input) {
  await new Promise((resolve) => window.setTimeout(resolve, 750));
  const evaluation = evaluateAsset(asset);
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    assetId: asset.id,
    input,
    output: `${asset.title} processed the test request successfully. The response would follow ${asset.sections.length} structured sections, preserve the stated context, and return an implementation-ready result for: “${input.trim()}”.`,
    evaluation,
    provider: asset.provider || "local-evaluator",
  };
}

export async function runTestSuite(asset, cases) {
  await new Promise((resolve) => window.setTimeout(resolve, 850));
  const evaluation = evaluateAsset(asset);
  return cases.map((testCase, index) => {
    const inputSignal = Math.min(testCase.input.trim().length / 18, 8);
    const score = clamp(evaluation.overall - 5 + inputSignal + (index % 3));
    return {
      ...testCase,
      score,
      status: score >= 80 ? "Passed" : "Review",
      latency: 620 + index * 137,
      runAt: new Date().toISOString(),
    };
  });
}

export async function compareModels(asset, input) {
  await new Promise((resolve) => window.setTimeout(resolve, 950));
  const base = evaluateAsset(asset).overall;
  return [
    { id: "gpt-5.6", name: "GPT-5.6", provider: "OpenAI", quality: clamp(base + 5), latency: 840, cost: "$0.014", best: true },
    { id: "gpt-5-mini", name: "GPT-5 mini", provider: "OpenAI", quality: clamp(base - 1), latency: 430, cost: "$0.004" },
    { id: "local", name: "Local structured", provider: "IntentOS", quality: clamp(base - 6), latency: 120, cost: "$0.000" },
  ].map((model, index) => ({
    ...model,
    output: `${model.name} produced an implementation-ready response for “${input.trim()}” using ${asset.sections.length} structured sections.`,
    rank: index + 1,
  }));
}

export async function runProviderEvaluation(asset, input) {
  try {
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ asset, input }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const payload = await response.json();
    const usage = payload.result.usage || {};
    return {
      ...payload.result,
      live: true,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      totalTokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
      estimatedCost: null,
    };
  } catch {
    const fallback = await runAssetTest(asset, input);
    const inputTokens = Math.max(1, Math.round(input.length / 4));
    const outputTokens = Math.max(1, Math.round(fallback.output.length / 4));
    return { output: fallback.output, latency: 120, provider: "IntentOS", model: "local-structured", executedAt: fallback.createdAt, live: false, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, estimatedCost: 0 };
  }
}

export function recommendRoute(models, priority = "balanced") {
  if (!models.length) return null;
  if (priority === "quality") return [...models].sort((a, b) => b.quality - a.quality)[0];
  if (priority === "speed") return [...models].sort((a, b) => a.latency - b.latency)[0];
  if (priority === "cost") return [...models].sort((a, b) => Number(a.cost.replace(/[$,]/g, "")) - Number(b.cost.replace(/[$,]/g, "")))[0];
  return [...models].sort((a, b) => (b.quality - a.quality) + (a.latency - b.latency) / 200)[0];
}

export async function improveAsset(asset) {
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  const evaluation = evaluateAsset(asset);
  const additions = [];
  if (!asset.sections.some((section) => /output|deliverable|result/i.test(section.label))) {
    additions.push({ label: "Output contract", content: "Return a prioritized, implementation-ready result with explicit assumptions, measurable success criteria, and a final self-review checklist." });
  }
  if (!asset.sections.some((section) => /example|edge/i.test(section.label))) {
    additions.push({ label: "Examples & edge cases", content: "Include one representative example, identify missing-input scenarios, and explain how ambiguous or conflicting constraints should be handled." });
  }
  if (!additions.length) {
    additions.push({ label: "Evaluation gate", content: "Before finalizing, score clarity, context coverage, completeness, reliability, and alignment with the requested outcome." });
  }

  return {
    ...asset,
    version: asset.version + 1,
    createdAt: new Date().toISOString(),
    summary: `${asset.summary.replace(/\.$/, "")} with stronger output controls and evaluation coverage.`,
    sections: [...asset.sections, ...additions],
    provider: `${asset.provider || "local-structured"}:auto-improve`,
    improvement: {
      fromVersion: asset.version,
      previousScore: evaluation.overall,
      changes: additions.map((section) => `Added ${section.label}`),
    },
  };
}
