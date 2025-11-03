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

    // ✅ Extract the actual post content (strip instruction like "generate headline for this drafted post:")
    let postContent = cleanText;

    // Check if text contains "generate" instruction and extract actual post
    if (
      cleanText.toLowerCase().includes("generate") &&
      cleanText.toLowerCase().includes("post")
    ) {
      // Find the colon after "post:" and get everything after it
      const colonIndex = cleanText.indexOf(":");
      if (colonIndex > -1) {
        postContent = cleanText.substring(colonIndex + 1).trim();
      }
    }

    console.log(`📝 [WORKFLOW] Post content: "${postContent}"`);

    // ✅ Extract main topic - get first meaningful sentence (up to 80 chars)
    let mainTopic = "";

    // Try to get first complete sentence
    const sentences = postContent.split(/\.\s+/);
    if (sentences.length > 0 && sentences[0]) {
      // Take first sentence but cap at 80 chars for headline
      const firstSentence = sentences[0].trim();
      mainTopic =
        firstSentence.length > 80
          ? firstSentence.substring(0, 80).trim()
          : firstSentence;
    } else {
      // Fallback: take first 80 chars
      mainTopic =
        postContent.length > 80
          ? postContent.substring(0, 80).trim()
          : postContent.trim();
    }

    // Remove trailing emojis and punctuation
    mainTopic = mainTopic
      .replace(/[🎉🚀💪]+\s*$/g, "")
      .replace(/[,;:]$/g, "")
      .trim();

    console.log(`📝 [WORKFLOW] Extracted topic: "${mainTopic}"`);

    // ✅ Generate UNIQUE, RELEVANT headlines based on content analysis
    // Analyze the content to understand what it's about
    const lowerContent = postContent.toLowerCase();
    let headlines = [];

    // Check content type and generate appropriate headlines
    if (
      lowerContent.includes("completed") ||
      lowerContent.includes("finished") ||
      lowerContent.includes("built")
    ) {
      // Achievement-based headlines
      headlines = [
        `🎉 ${mainTopic}`,
        `Proud to Share: ${mainTopic}`,
        `From Start to Finish — ${mainTopic}`,
        `Achievement Unlocked: ${mainTopic}`,
        `${mainTopic} 🚀`,
      ];
    } else if (
      lowerContent.includes("trump") ||
      lowerContent.includes("nigeria") ||
      lowerContent.includes("government") ||
      lowerContent.includes("relationship")
    ) {
      // News/Analysis headlines
      headlines = [
        `Breaking: ${mainTopic}`,
        `${mainTopic} — What This Means`,
        `Analysis: ${mainTopic}`,
        `${mainTopic} 🌍`,
        `Understanding the Impact: ${mainTopic}`,
      ];
    } else if (
      lowerContent.includes("excited") ||
      lowerContent.includes("thrilled") ||
      lowerContent.includes("happy")
    ) {
      // Excitement-based headlines
      headlines = [
        `🎉 ${mainTopic}`,
        `${mainTopic} 🚀`,
        `Big News: ${mainTopic}`,
        `Celebrating: ${mainTopic}`,
        `${mainTopic} — A Milestone!`,
      ];
    } else {
      // General/Professional headlines
      headlines = [
        `${mainTopic}`,
        `Insights: ${mainTopic}`,
        `${mainTopic} — Key Takeaways`,
        `Reflecting on: ${mainTopic}`,
        `${mainTopic} 💡`,
      ];
    }

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

    // ✅ Create numbered headline list for better readability
    const numberedHeadlines = headlines
      .map((headline, index) => `${index + 1}. ${headline}`)
      .join("\n\n");

    const responseText = `Here are ${headlines.length} LinkedIn headline options:\n\n${numberedHeadlines}\n\n💡 Recommended: ${bestHeadline}`;

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
