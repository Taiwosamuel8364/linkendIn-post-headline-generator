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

    // ✅ Use AI Agent to generate creative, relevant headlines
    console.log("🤖 [WORKFLOW] Calling AI agent to generate headlines...");

    const prompt = `Generate exactly 5 compelling LinkedIn post headlines for the following content. Make them diverse, engaging, and professional.

Post content:
${postContent}

Requirements:
- Create 5 DIFFERENT headline styles (not just variations of the same headline)
- Keep each headline between 40-100 characters
- Make them attention-grabbing and professional
- Use relevant emojis sparingly (max 1-2 per headline)
- Include diverse approaches: question-based, statement, insight, data-driven, etc.
- Focus on the key message and value proposition

Return ONLY the 5 headlines, one per line, without numbers or bullet points.`;

    const aiResponse = await linkedinAgent.generate(prompt);

    console.log("🤖 [WORKFLOW] AI agent response:", aiResponse.text);

    // Parse AI response into headlines array
    const headlines = aiResponse.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^[0-9]+\./)) // Remove empty lines and numbers
      .slice(0, 5); // Take only first 5

    // Fallback if AI didn't return 5 headlines
    if (headlines.length < 5) {
      console.warn(
        "⚠️ [WORKFLOW] AI returned fewer than 5 headlines, adding fallbacks"
      );
      while (headlines.length < 5) {
        headlines.push(`${mainTopic} 💡`);
      }
    }

    console.log(
      `✅ [WORKFLOW] Generated ${headlines.length} headlines from AI`
    );

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
