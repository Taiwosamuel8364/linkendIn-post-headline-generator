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

// ✅ Output schema matching JSON-RPC 2.0 format
const outputSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  result: z.object({
    id: z.string(),
    contextId: z.string().optional(),
    status: z.object({
      state: z.enum(["completed", "processing", "failed"]),
      timestamp: z.string(),
      message: z.object({
        messageId: z.string(),
        role: z.literal("agent"),
        parts: z.array(
          z.object({
            kind: z.literal("text"),
            text: z.string(),
          })
        ),
        kind: z.literal("message"),
      }),
    }),
    artifacts: z.array(
      z.object({
        artifactId: z.string(),
        name: z.string(),
        parts: z.array(
          z.union([
            z.object({
              kind: z.literal("text"),
              text: z.string(),
            }),
            z.object({
              kind: z.literal("data"),
              data: z.any(),
            }),
          ])
        ),
      })
    ),
  }),
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

    // ✅ Normalize input (handles both string and object cases)
    const { text, targetAudience, tone } =
      typeof inputData === "string"
        ? {
            text: inputData,
            targetAudience: undefined,
            tone: "professional" as const,
          }
        : inputData;

    // ✅ Generate LinkedIn-style headlines
    const headlines = [
      `${text} 🚀`,
      `Just shipped: ${text}`,
      `Excited to share: ${text}`,
      `${text} — my latest project`,
      `Lessons learned from ${text}`,
    ];

    const output = {
      headlines,
      text,
      targetAudience,
      tone: tone || ("professional" as const),
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
  outputSchema: z.object({
    headlines: z.array(z.string()),
    bestHeadline: z.string(),
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log(
      "🔄 [WORKFLOW] Select Best Headline Step - Input:",
      JSON.stringify(inputData, null, 2)
    );

    const { headlines, text } = inputData;
    const bestHeadline = headlines[0]; // could add AI ranking later

    const output = {
      headlines,
      bestHeadline,
      text,
    };

    console.log(
      "✅ [WORKFLOW] Select Best Headline Step - Output:",
      JSON.stringify(output, null, 2)
    );
    return output;
  },
});

// Step 3: Format result in JSON-RPC 2.0 format with numbered headlines
const formatJsonRpcResponseStep = createStep({
  id: "format-jsonrpc-response",
  description: "Format the result in JSON-RPC 2.0 format for Telex A2A",
  inputSchema: z.object({
    headlines: z.array(z.string()),
    bestHeadline: z.string(),
    text: z.string(),
  }),
  outputSchema: outputSchema,
  execute: async ({ inputData }) => {
    console.log(
      "🔄 [WORKFLOW] Format JSON-RPC Response Step - Input:",
      JSON.stringify(inputData, null, 2)
    );

    const { headlines, bestHeadline, text } = inputData;
    const timestamp = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    const messageId = `msg-${Date.now()}`;
    const artifactId = `artifact-${Date.now()}`;
    const dataArtifactId = `data-${Date.now()}`;

    // ✅ Format headlines with numbers and line breaks
    const formattedHeadlines = headlines
      .map((headline, index) => `${index + 1}. ${headline}`)
      .join("\n\n");

    const responseText = `Here are ${headlines.length} LinkedIn headline options for "${text}":\n\n${formattedHeadlines}\n\n💡 Recommended: ${bestHeadline}`;

    const output = {
      jsonrpc: "2.0" as const,
      id: "request-001", // This will be replaced with the actual request ID
      result: {
        id: taskId,
        contextId: `context-${Date.now()}`,
        status: {
          state: "completed" as const,
          timestamp: timestamp,
          message: {
            messageId: messageId,
            role: "agent" as const,
            parts: [
              {
                kind: "text" as const,
                text: responseText,
              },
            ],
            kind: "message" as const,
          },
        },
        artifacts: [
          {
            artifactId: artifactId,
            name: "linkedinHeadlineResponse",
            parts: [
              {
                kind: "text" as const,
                text: responseText,
              },
            ],
          },
          {
            artifactId: dataArtifactId,
            name: "HeadlineResults",
            parts: [
              {
                kind: "data" as const,
                data: {
                  bestHeadline: bestHeadline,
                  allHeadlines: headlines,
                  topic: text,
                  generatedAt: timestamp,
                },
              },
            ],
          },
        ],
      },
    };

    console.log(
      "✅ [WORKFLOW] Format JSON-RPC Response Step - Output:",
      JSON.stringify(output, null, 2)
    );
    return output;
  },
});

// ✅ Create the workflow
export const linkedinHeadlineWorkflow = createWorkflow({
  id: "linkedin-headline-generator",
  inputSchema: inputSchema,
  outputSchema: outputSchema,
})
  .then(generateHeadlinesStep)
  .then(selectBestHeadlineStep)
  .then(formatJsonRpcResponseStep)
  .commit();
