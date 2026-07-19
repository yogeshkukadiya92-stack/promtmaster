export const assetSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "summary", "purpose", "context", "sections"],
  properties: {
    type: { type: "string", enum: ["Prompt", "Skill", "Agent"] },
    title: { type: "string", minLength: 3, maxLength: 100 },
    summary: { type: "string", minLength: 12, maxLength: 240 },
    purpose: { type: "string", minLength: 12, maxLength: 500 },
    context: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 3, maxLength: 240 },
    },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "content"],
        properties: {
          label: { type: "string", minLength: 2, maxLength: 60 },
          content: { type: "string", minLength: 8, maxLength: 1200 },
        },
      },
    },
  },
};

export function normalizeMode(mode) {
  if (mode === "prompt") return "Prompt";
  if (mode === "skill") return "Skill";
  return "Agent";
}
