import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { linkedinHeadlineWorkflow } from "./workflows/linkedin-headline.workflow";
import { linkedinAgent } from "./agents/linkedin-agent";

export const mastra = new Mastra({
  workflows: { linkedinHeadlineWorkflow },
  agents: { linkedinAgent },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT ? parseInt(process.env.PORT) : 4111,
    apiRoutes: [
      {
        path: "/webhook/linkedin-headline",
        method: "POST",
        createHandler: async ({ mastra }) => {
          return async (request: any) => {
            const timestamp = new Date().toISOString();
            console.log(`\n${"=".repeat(60)}`);
            console.log(
              `📨 [WEBHOOK] New A2A request received at ${timestamp}`
            );
            console.log(`${"=".repeat(60)}`);

            try {
              // Parse the JSON-RPC 2.0 request
              let body;
              const rawReq = request.raw || request.req || request;

              if (typeof rawReq.text === "function") {
                console.log("Using request.text()");
                const textBody = await rawReq.text();
                console.log("📥 [WEBHOOK] Raw text body:", textBody);
                body = JSON.parse(textBody);
              } else if (rawReq.body) {
                console.log("Using request.body");
                body = rawReq.body;
              } else if (rawReq.on) {
                console.log("Using stream reading");
                body = await new Promise((resolve, reject) => {
                  let data = "";
                  rawReq.on("data", (chunk: any) => {
                    data += chunk;
                  });
                  rawReq.on("end", () => {
                    try {
                      resolve(JSON.parse(data));
                    } catch (e) {
                      reject(e);
                    }
                  });
                  rawReq.on("error", reject);
                });
              }

              console.log(
                "📥 [WEBHOOK] Parsed JSON-RPC request:",
                JSON.stringify(body, null, 2)
              );

              // Validate JSON-RPC 2.0 format
              if (!body || body.jsonrpc !== "2.0") {
                console.log("❌ [WEBHOOK] Error: Invalid JSON-RPC 2.0 request");
                return new Response(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: body?.id || null,
                    error: {
                      code: -32600,
                      message: "Invalid Request - must be JSON-RPC 2.0",
                    },
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              // Extract text from message parts
              const message = body.params?.message;
              if (!message || !message.parts || !Array.isArray(message.parts)) {
                console.log("❌ [WEBHOOK] Error: Missing message parts");
                return new Response(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    error: {
                      code: -32602,
                      message: "Invalid params - missing message.parts",
                    },
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              // Extract text from the first text part
              const textPart = message.parts.find(
                (part: any) => part.kind === "text"
              );
              if (!textPart || !textPart.text) {
                console.log(
                  "❌ [WEBHOOK] Error: No text part found in message"
                );
                return new Response(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: body.id,
                    error: {
                      code: -32602,
                      message: "Invalid params - no text part in message",
                    },
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              const userText = textPart.text;
              console.log(`💬 [WEBHOOK] Extracted user text: "${userText}"`);
              console.log(`� [WEBHOOK] Task ID: ${message.taskId}`);
              console.log(`📧 [WEBHOOK] Message ID: ${message.messageId}`);
              console.log(`�🚀 [WEBHOOK] Starting workflow execution...`);

              // Execute the workflow with the extracted text
              const workflow = mastra.getWorkflow("linkedinHeadlineWorkflow");
              const run = await workflow.createRunAsync();
              const result = await run.start({
                inputData: userText, // Pass the text directly
              });

              console.log(
                "✅ [WEBHOOK] Workflow execution completed successfully"
              );
              console.log(
                "📤 [WEBHOOK] Response:",
                JSON.stringify(result, null, 2)
              );
              console.log(`${"=".repeat(60)}\n`);

              // The workflow already returns JSON-RPC 2.0 format
              return new Response(JSON.stringify(result), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              console.error("❌ [WEBHOOK] Error occurred:");
              console.error(
                "Error type:",
                error instanceof Error ? error.constructor.name : typeof error
              );
              console.error(
                "Error message:",
                error instanceof Error ? error.message : String(error)
              );
              console.error(
                "Error stack:",
                error instanceof Error ? error.stack : "No stack trace"
              );
              console.log(`${"=".repeat(60)}\n`);

              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: null,
                  error: {
                    code: -32603,
                    message: "Internal error",
                    data:
                      error instanceof Error ? error.message : String(error),
                  },
                }),
                {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          };
        },
      },
    ],
  },
});
