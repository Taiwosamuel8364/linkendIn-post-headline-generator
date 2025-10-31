import { Workflow, Step } from "@mastra/core";
import { z } from "zod";

// Define the input schema for the workflow
const inputSchema = z.object({
  topic: z.string().describe("The main topic or theme for the LinkedIn post"),
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

export const linkedinHeadlineWorkflow = new Workflow({
  name: "linkedin-headline-generator",
  triggerSchema: inputSchema,
})
  .step(
    Step.create({
      id: "generate-headlines",
      execute: async ({ context }) => {
        const { topic, targetAudience, tone } =
          context.machineContext.triggerData;

        // Generate multiple headline variations
        const headlines = [
          `${topic}: What You Need to Know`,
          `The Ultimate Guide to ${topic}`,
          `How ${topic} Changed My Perspective`,
          `${topic} - Insights from the Field`,
          `Why ${topic} Matters Now More Than Ever`,
        ];

        return {
          headlines,
          topic,
          targetAudience,
          tone,
        };
      },
    })
  )
  .step(
    Step.create({
      id: "select-best-headline",
      execute: async ({ context }) => {
        const { headlines } = context.stepResults["generate-headlines"];

        // Simple selection logic - in production, you'd use AI to rank these
        const bestHeadline = headlines[0];

        return {
          headlines,
          bestHeadline,
        };
      },
    })
  )
  .commit();
