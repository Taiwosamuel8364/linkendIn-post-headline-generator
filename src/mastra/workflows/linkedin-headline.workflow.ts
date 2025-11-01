import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// ✅ Input schema now supports both plain text and object input
const inputSchema = z.union([
  z.string(),
  z.object({
    text: z.string().describe("The main topic or theme for the LinkedIn post"),
    targetAudience: z
      .string()
      .optional()
      .describe("Target audience for the post"),
    tone: z
      .enum(["professional", "casual", "inspirational", "educational"])
      .optional()
      .default("professional"),
  }),
]);

// ✅ Output schema for the final workflow - matches what Telex expects
const outputSchema = z.object({
  message: z.string(), // ✅ Telex expects this key
  headlines: z.array(z.string()).optional(), // Include all headlines too
});

// Step 1: Generate headlines
const generateHeadlinesStep = createStep({
  id: "generate-headlines",
  description: "Generate multiple headline variations based on topic",
  inputSchema: inputSchema,
  outputSchema: z.object({
    headlines: z.array(z.string()),
    text: z.string(),
    targetAudience: z.string().optional(),
    tone: z.enum(["professional", "casual", "inspirational", "educational"]),
  }),
  execute: async ({ inputData }) => {
    console.log("🔄 [WORKFLOW] Generate Headlines Step - Input:", inputData);

    // ✅ Normalize input (handles both string and object cases)
    const { text, targetAudience, tone } =
      typeof inputData === "string"
        ? {
            text: inputData,
            targetAudience: undefined,
            tone: "professional" as const,
          }
        : inputData;

    // ✅ Simple headline generator
    const headlines = [
      `Just ${text} 🚀`,
      `Highlights from my recent work: ${text}`,
      `Proud moment: ${text}!`,
      `${text} — lessons and reflections`,
      `Wrapping up ${text}: my journey as a backend developer`,
    ];

    const output = {
      headlines,
      text,
      targetAudience,
      tone: tone || ("professional" as const),
    };

    console.log("✅ [WORKFLOW] Generate Headlines Step - Output:", output);
    return output;
  },
});

// Step 2: Select best headline
const selectBestHeadlineStep = createStep({
  id: "select-best-headline",
  description: "Select the best headline from generated options",
  inputSchema: z.object({
    headlines: z.array(z.string()),
    text: z.string(),
    targetAudience: z.string().optional(),
    tone: z.enum(["professional", "casual", "inspirational", "educational"]),
  }),
  outputSchema: z.object({
    headlines: z.array(z.string()),
    bestHeadline: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("🔄 [WORKFLOW] Select Best Headline Step - Input:", inputData);

    const { headlines } = inputData;
    const bestHeadline = headlines[0]; // could add AI ranking later

    const output = {
      headlines,
      bestHeadline,
    };

    console.log("✅ [WORKFLOW] Select Best Headline Step - Output:", output);
    return output;
  },
});

// Step 3: Format result for Telex display
const returnHeadlineStep = createStep({
  id: "return-best-headline",
  description: "Return the best headline in a format Telex can display",
  inputSchema: z.object({
    headlines: z.array(z.string()),
    bestHeadline: z.string(),
  }),
  outputSchema: outputSchema,
  execute: async ({ inputData }) => {
    console.log("🔄 [WORKFLOW] Return Best Headline Step - Input:", inputData);

    const output = {
      message: inputData.bestHeadline,
      headlines: inputData.headlines,
    };

    console.log("✅ [WORKFLOW] Return Best Headline Step - Output:", output);
    return output;
  },
});

// ✅ Create the workflow
export const linkedinHeadlineWorkflow = createWorkflow({
  id: "LnkdHdlGenX5A3pQ", // 🔗 must match your JSON workflow ID
  inputSchema: inputSchema,
  outputSchema: outputSchema,
})
  .then(generateHeadlinesStep)
  .then(selectBestHeadlineStep)
  .then(returnHeadlineStep)
  .commit();
