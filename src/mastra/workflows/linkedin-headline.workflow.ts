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

// ✅ JSON-RPC 2.0 output schema for A2A
const outputSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  result: z.object({
    id: z.string(),
    contextId: z.string(),
    status: z.object({
      state: z.literal("completed"),
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
    artifacts: z.array(z.any()),
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

    // ✅ Extract clean text from HTML and get key phrases
    const cleanText = text
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Remove &nbsp;
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // ✅ Extract main achievement/topic - take the first complete sentence or phrase
    let mainTopic = "";
    const firstSentence = cleanText.split(/[.!?]/)[0].trim();

    // Try to find a key achievement phrase
    const achievementMatch = firstSentence.match(
      /(?:completed|built|shipped|created|launched|finished)\s+([^,]+)/i
    );

    if (achievementMatch && achievementMatch[1]) {
      mainTopic = achievementMatch[1].trim();
    } else {
      // Fall back to first sentence, but limit to reasonable length
      mainTopic =
        firstSentence.length > 80
          ? firstSentence.substring(0, 80).trim()
          : firstSentence;
    }

    // ✅ Generate SHORT, catchy LinkedIn-style headlines
    const headlines = [
      `🎉 Just Completed: ${mainTopic}`,
      `${mainTopic} 🚀`,
      `Excited to Share: ${mainTopic}`,
      `${mainTopic} — My Latest Achievement`,
      `Key Learnings from ${mainTopic}`,
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
  description: "Select the best headline from the generated options",
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
    // For now, just pick the first one
    const bestHeadline = headlines[0];

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

// Step 3: Format result in JSON-RPC 2.0 format
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

    // ✅ Create response text with all headlines
    const headlinesList = headlines.join("\n");
    const responseText = `Here are ${headlines.length} LinkedIn headline options for "${text}":\n\n${headlinesList}\n\n💡 Recommended: ${bestHeadline}`;

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
