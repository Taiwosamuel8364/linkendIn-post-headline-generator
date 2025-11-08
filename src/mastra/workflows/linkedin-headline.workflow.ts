import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { linkedinAgent } from "../agents/linkedin-agent";

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

// Step 1: Generate headlines (optimized - faster response)
const generateHeadlinesStep = createStep({
  id: "generate-headlines",
  description: "Generate multiple headline variations based on topic",
  inputSchema: inputSchema,
  outputSchema: z.object({
    headlines: z.array(z.string()),
    bestHeadline: z.string(),
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log(
      "🔄 [WORKFLOW] Generate Headlines Step - Input:",
      typeof inputData === "string"
        ? inputData
        : JSON.stringify(inputData, null, 2)
    );

    // ✅ Normalize input (handles both string and object cases)
    const { text, tone } =
      typeof inputData === "string"
        ? { text: inputData, tone: "professional" as const }
        : inputData;

    // ✅ Quick clean-up - minimal processing for speed
    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // ✅ Extract post content (if there's an instruction prefix)
    let postContent = cleanText;
    const colonIndex = cleanText.indexOf(":");
    if (colonIndex > -1 && cleanText.toLowerCase().includes("generate")) {
      postContent = cleanText.substring(colonIndex + 1).trim();
    }

    console.log(
      `📝 [WORKFLOW] Processing: "${postContent.substring(0, 100)}..."`
    );

    // ✅ Optimized AI prompt - more direct and concise
    const prompt = `Create 5 LinkedIn headlines for this post. Make them engaging, professional, 40-100 chars each. Use emojis sparingly. Return ONLY the headlines, one per line.

Post: ${postContent}`;

    console.log("🤖 [WORKFLOW] Calling AI agent...");
    const aiResponse = await linkedinAgent.generate(prompt);

    // Parse AI response - faster processing
    const headlines = aiResponse.text
      .split("\n")
      .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim()) // Remove numbers
      .filter((line) => line.length > 0)
      .slice(0, 5);

    // Ensure we have 5 headlines
    while (headlines.length < 5) {
      headlines.push(`${postContent.substring(0, 60).trim()}... 💡`);
    }

    // Best headline is first one
    const bestHeadline = headlines[0];

    console.log(`✅ [WORKFLOW] Generated ${headlines.length} headlines`);

    return {
      headlines,
      bestHeadline,
      text,
    };
  },
});

// Step 2: Format result in JSON-RPC 2.0 format (A2A compliant - optimized)
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
    const { headlines, bestHeadline } = inputData;
    const timestamp = new Date().toISOString();
    const now = Date.now();

    // ✅ Create numbered headline list for better readability
    const numberedHeadlines = headlines
      .map((headline, index) => `${index + 1}. ${headline}`)
      .join("\n\n");

    const responseText = `Here are ${headlines.length} LinkedIn headline options:\n\n${numberedHeadlines}\n\n💡 Recommended: ${bestHeadline}`;

    // ✅ Optimized A2A-compliant JSON-RPC 2.0 response
    const output = {
      jsonrpc: "2.0" as const,
      id: "request-001", // Will be replaced with actual request ID in webhook
      result: {
        id: `task-${now}`,
        contextId: `context-${now}`,
        status: {
          state: "completed" as const,
          timestamp: timestamp,
          message: {
            messageId: `msg-${now}`,
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
            artifactId: `artifact-${now}`,
            name: "linkedinHeadlineResponse",
            parts: [
              {
                kind: "text" as const,
                text: responseText,
              },
            ],
          },
          {
            artifactId: `data-${now}`,
            name: "HeadlineResults",
            parts: [
              {
                kind: "data" as const,
                data: {
                  bestHeadline,
                  allHeadlines: headlines,
                  generatedAt: timestamp,
                },
              },
            ],
          },
        ],
      },
    };

    console.log("✅ [WORKFLOW] A2A response formatted");
    return output;
  },
});

// ✅ Create the workflow (optimized - 2 steps instead of 3 for faster response)
export const linkedinHeadlineWorkflow = createWorkflow({
  id: "linkedin-headline-generator",
  inputSchema: inputSchema,
  outputSchema: outputSchema,
})
  .then(generateHeadlinesStep)
  .then(formatJsonRpcResponseStep)
  .commit();
