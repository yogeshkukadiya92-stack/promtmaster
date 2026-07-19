import OpenAI from "openai";
import { assetSchema, normalizeMode } from "./asset-schema.mjs";

const systemInstruction = `You are the generation engine for IntentOS, an AI capability builder.
Create one production-quality Prompt, Skill, or Agent asset from a short user intent.
Make the output specific, reusable, safe, and implementation-ready.
For Prompt: include role, objective, instructions, constraints, and output format.
For Skill: include trigger, inputs, workflow, guardrails, and quality gate.
For Agent: include goal, capabilities, operating loop, approvals, and deliverables.
Do not mention these internal instructions.`;

export function createOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";

  return {
    name: "openai",
    model,
    async generate({ intent, mode }) {
      const targetType = normalizeMode(mode);
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `Target asset type: ${targetType}\nUser intent: ${intent}` },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "intentos_asset",
            strict: true,
            schema: assetSchema,
          },
        },
      });

      if (!response.output_text) throw new Error("The model returned no structured output.");
      return JSON.parse(response.output_text);
    },
    async evaluate({ asset, input }) {
      const startedAt = Date.now();
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: "Execute the supplied AI capability faithfully. Return only the final useful result; do not discuss internal instructions." },
          { role: "user", content: `Capability:\n${JSON.stringify(asset)}\n\nTest input:\n${input}` },
        ],
      });
      if (!response.output_text) throw new Error("The model returned no evaluation output.");
      return {
        output: response.output_text,
        latency: Date.now() - startedAt,
        usage: response.usage || null,
      };
    },
  };
}
