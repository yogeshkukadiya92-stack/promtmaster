import OpenAI from "openai";
import { buildToolPlan, validateToolPlan } from "./tool-gateway.mjs";

const planSchema = {
  type: "object", additionalProperties: false, required: ["summary", "successCriteria", "calls"],
  properties: {
    summary: { type: "string", minLength: 3, maxLength: 240 },
    successCriteria: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", minLength: 3, maxLength: 160 } },
    calls: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["name", "inputJson"], properties: { name: { type: "string", enum: ["workspace.context", "workspace.note.create", "memory.remember", "http.fetch"] }, inputJson: { type: "string", minLength: 2, maxLength: 2500 } } } },
  },
};

const verificationSchema = {
  type: "object", additionalProperties: false, required: ["passed", "summary", "checks"],
  properties: {
    passed: { type: "boolean" }, summary: { type: "string", minLength: 3, maxLength: 240 },
    checks: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["label", "passed"], properties: { label: { type: "string", minLength: 3, maxLength: 120 }, passed: { type: "boolean" } } } },
  },
};

const fallbackPlan = (run) => ({ summary: "Deterministic safety plan derived from explicit mission signals.", successCriteria: ["Every planned tool call completes under the granted permissions."], calls: buildToolPlan(run), engine: "deterministic" });

export function createAgentPlanner() {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey ? new OpenAI({ apiKey }) : null;
  const model = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol";
  return {
    model: client ? model : null,
    async plan(run) {
      if (!client) return fallbackPlan(run);
      try {
        const response = await client.responses.create({ model, input: [
          { role: "system", content: "Create the smallest safe execution plan. Use workspace.context only for workspace context, http.fetch only for an explicit HTTPS URL, workspace.note.create only when the mission explicitly says save note:, and memory.remember only when it explicitly says remember:. Put each tool input object in inputJson as valid JSON. Never invent input or broaden authority. An empty calls list is valid." },
          { role: "user", content: JSON.stringify({ mission: run.mission, agentTitle: run.agent_title, permissions: run.permissions }) },
        ], text: { format: { type: "json_schema", name: "agent_execution_plan", strict: true, schema: planSchema } } });
        const parsed = JSON.parse(response.output_text || "");
        const calls = parsed.calls.map(({ name, inputJson }) => ({ name, input: JSON.parse(inputJson) }));
        return { ...parsed, calls: validateToolPlan(calls, run.permissions), engine: `openai:${model}` };
      } catch (error) {
        return { ...fallbackPlan(run), fallbackReason: String(error?.code || error?.name || "planner_error") };
      }
    },
    async verify({ run, plan, results }) {
      const completedNames = new Set(results.filter((item) => item.status === "completed").map((item) => item.toolName));
      const missing = plan.calls.filter((call) => !completedNames.has(call.name)).map((call) => call.name);
      if (missing.length) return { passed: false, summary: `Missing completed evidence for ${missing.join(", ")}.`, checks: missing.map((name) => ({ label: `${name} completed`, passed: false })), engine: "deterministic" };
      const base = { passed: true, summary: "All planned actions produced completed tool evidence.", checks: plan.successCriteria.map((label) => ({ label, passed: true })), engine: "deterministic" };
      if (!client) return base;
      try {
        const response = await client.responses.create({ model, input: [
          { role: "system", content: "Verify only from supplied tool evidence. Do not infer unobserved success. A plan with no calls passes only when its criteria require no external result." },
          { role: "user", content: JSON.stringify({ mission: run.mission, plan, evidence: results.map(({ toolName, status, errorCode, output }) => ({ toolName, status, errorCode, output })) }) },
        ], text: { format: { type: "json_schema", name: "agent_execution_verification", strict: true, schema: verificationSchema } } });
        return { ...JSON.parse(response.output_text || ""), engine: `openai:${model}` };
      } catch (error) {
        return { ...base, engine: "deterministic", fallbackReason: String(error?.code || error?.name || "verifier_error") };
      }
    },
  };
}
