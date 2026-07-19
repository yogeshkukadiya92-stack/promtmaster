const titleFromIntent = (intent, type) => {
  const clean = intent.trim().replace(/[.!?]+$/, "");
  const compact = clean.length > 58 ? `${clean.slice(0, 55).trim()}…` : clean;
  return `${compact} ${type}`;
};

const shared = (intent) => ({
  purpose: `Turn “${intent.trim()}” into a clear, reliable and ready-to-use outcome.`,
  context: [
    "Audience and success criteria must be explicit",
    "Output must be practical, specific, and reusable",
    "Assumptions should be stated instead of hidden",
  ],
});

const promptAsset = (intent) => ({
  type: "Prompt",
  title: titleFromIntent(intent, "Prompt"),
  summary: "A model-ready instruction with context, constraints, and a reliable output format.",
  ...shared(intent),
  sections: [
    { label: "Role", content: "Act as a senior strategist with domain expertise and strong execution judgment." },
    { label: "Objective", content: intent.trim() },
    { label: "Instructions", content: "Clarify the audience, develop the approach step by step, surface risks, and produce implementation-ready deliverables." },
    { label: "Output", content: "Return an executive summary, structured plan, prioritized actions, timeline, and quality checklist." },
  ],
});

const skillAsset = (intent) => ({
  type: "Skill",
  title: titleFromIntent(intent, "Skill"),
  summary: "A reusable capability with triggers, workflow, guardrails, and quality checks.",
  ...shared(intent),
  sections: [
    { label: "Trigger", content: `Use this skill whenever the user needs to ${intent.trim().toLowerCase()}.` },
    { label: "Inputs", content: "Goal, audience, constraints, source material, output channel, and deadline." },
    { label: "Workflow", content: "Validate inputs → identify missing context → draft → self-review → deliver the final structured result." },
    { label: "Quality gate", content: "Check specificity, completeness, consistency, safety, and whether every deliverable is actionable." },
  ],
});

const agentAsset = (intent) => ({
  type: "Agent",
  title: titleFromIntent(intent, "Agent"),
  summary: "A configurable agent blueprint with goals, skills, approval points, and deliverables.",
  ...shared(intent),
  sections: [
    { label: "Goal", content: intent.trim() },
    { label: "Capabilities", content: "Research, planning, content development, prioritization, execution support, and measurement." },
    { label: "Operating loop", content: "Understand objective → build plan → request approval → execute approved steps → evaluate and improve." },
    { label: "Human approval", content: "Require approval before publishing, sending messages, spending money, or changing external data." },
  ],
});

async function generateLocalAsset({ intent, mode }) {
  await new Promise((resolve) => window.setTimeout(resolve, 850));
  const resolvedMode = mode === "auto" ? "agent" : mode;
  const content = resolvedMode === "prompt"
    ? promptAsset(intent)
    : resolvedMode === "skill"
      ? skillAsset(intent)
      : agentAsset(intent);

  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    sourceIntent: intent.trim(),
    provider: "local-structured",
    ...content,
  };
}

export async function getProviderStatus() {
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Provider status unavailable");
    return response.json();
  } catch {
    return {
      ok: true,
      ai: { enabled: false, provider: "local-fallback" },
      database: { enabled: false, provider: "browser-storage" },
    };
  }
}

export async function generateAsset({ intent, mode, accessToken }) {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ intent, mode }),
    });
    if (response.ok) {
      const payload = await response.json();
      return payload.asset;
    }
    if (response.status !== 503) throw new Error("Remote generation failed");
  } catch {
    // The local structured generator keeps the product usable during provider setup or outages.
  }
  return generateLocalAsset({ intent, mode });
}
