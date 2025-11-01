import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Define the input schema for the workflow
const inputSchema = z.object({
  text: z.string().describe("The main topic or theme for the LinkedIn post"),
  targetAudience: z
    .string()
    .optional()
    .describe("Target audience for the post"),
  tone: z
    .enum(["professional", "casual", "inspirational", "educational"])
    .optional()
    .default("professional"),
});

// Define the output schema
const outputSchema = z.object({
  headlines: z.array(z.string()).describe("Generated LinkedIn post headlines"),
  bestHeadline: z.string().describe("The recommended headline"),
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
    console.log(
      "🔄 [WORKFLOW] Generate Headlines Step - Input:",
      JSON.stringify(inputData, null, 2)
    );

    const { text, targetAudience, tone } = inputData;

    // Generate multiple headline variations
    const headlines = [
      `${text}: What You Need to Know`,
      `The Ultimate Guide to ${text}`,
      `How ${text} Changed My Perspective`,
      `${text} - Insights from the Field`,
      `Why ${text} Matters Now More Than Ever`,
    ];

    const output = {
      headlines,
      text,
      targetAudience,
      tone: tone || "professional",
    };

    console.log(
      "✅ [WORKFLOW] Generate Headlines Step - Output:",
      JSON.stringify(output, null, 2)
    );

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
  outputSchema: outputSchema,
  execute: async ({ inputData }) => {
    console.log(
      "🔄 [WORKFLOW] Select Best Headline Step - Input:",
      JSON.stringify(inputData, null, 2)
    );

    const { headlines } = inputData;

    // Simple selection logic - in production, you'd use AI to rank these
    const bestHeadline = headlines[0];

    const output = {
      headlines,
      bestHeadline,
    };

    console.log(
      "✅ [WORKFLOW] Select Best Headline Step - Output:",
      JSON.stringify(output, null, 2)
    );

    return output;
  },
});

// Create the workflow
export const linkedinHeadlineWorkflow = createWorkflow({
  id: "linkedin-headline-generator",
  inputSchema: inputSchema,
  outputSchema: outputSchema,
})
  .then(generateHeadlinesStep)
  .then(selectBestHeadlineStep)
  .then({
    id: "return-best-headline",
    description: "Return the best headline in a format Telex can display",
    inputSchema: outputSchema,
    outputSchema: z.object({
      message: z.string(), // ✅ Telex-friendly key
    }),
    execute: async ({ inputData }) => {
      console.log(
        "🔄 [WORKFLOW] Return Best Headline Step - Input:",
        JSON.stringify(inputData, null, 2)
      );

      const output = {
        message: inputData.bestHeadline,
      };

      console.log(
        "✅ [WORKFLOW] Return Best Headline Step - Output:",
        JSON.stringify(output, null, 2)
      );

      return output;
    },
  })
  .commit();
