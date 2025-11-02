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
              const requestId = body.id; // Capture the request ID
              const taskId = message.taskId;
              const messageId = message.messageId;

              console.log(`💬 [WEBHOOK] Extracted user text: "${userText}"`);
              console.log(`📋 [WEBHOOK] Task ID: ${taskId}`);
              console.log(`📧 [WEBHOOK] Message ID: ${messageId}`);
              console.log(`🚀 [WEBHOOK] Starting workflow execution...`);

              // Execute the workflow with the extracted text - BLOCKING
              const workflow = mastra.getWorkflow(
                "linkedin-headline-generator"
              );
              const run = await workflow.createRunAsync();

              console.log("⏳ [WEBHOOK] Waiting for workflow to complete...");
              const workflowResult = await run.start({
                inputData: userText, // Pass the text directly
              });

              console.log("✅ [WEBHOOK] Workflow completed!");
              console.log(
                "✅ [WORKFLOW] Raw workflow result:",
                JSON.stringify(workflowResult, null, 2)
              );

              console.log(
                "🔍 [DEBUG] workflowResult.status:",
                workflowResult.status
              );
              console.log(
                "🔍 [DEBUG] workflowResult.result:",
                JSON.stringify((workflowResult as any).result, null, 2)
              );

              // Check if workflowResult has the expected JSON-RPC format
              // If not, we need to extract it from the result property
              let finalResult;

              if ((workflowResult as any).jsonrpc === "2.0") {
                // Already in correct format
                console.log("✅ [WEBHOOK] Found JSON-RPC at top level");
                finalResult = workflowResult;
              } else if (
                workflowResult.status === "success" &&
                (workflowResult as any).result?.jsonrpc === "2.0"
              ) {
                // Result is nested
                console.log("✅ [WEBHOOK] Found JSON-RPC nested in result");
                finalResult = (workflowResult as any).result;
              } else if (workflowResult.status === "success") {
                // Need to construct the response from workflow output
                console.log(
                  "⚠️ [WEBHOOK] Workflow didn't return JSON-RPC format, constructing response"
                );

                const timestamp = new Date().toISOString();
                const workflowOutput = (workflowResult as any).result || {};
                const bestHeadline =
                  workflowOutput.bestHeadline ||
                  workflowOutput.message ||
                  "LinkedIn Headline Generated";
                const allHeadlines = workflowOutput.headlines || [bestHeadline];

                finalResult = {
                  jsonrpc: "2.0",
                  id: requestId,
                  result: {
                    id: taskId,
                    contextId: `context-${Date.now()}`,
                    status: {
                      state: "completed",
                      timestamp: timestamp,
                      message: {
                        messageId: `response-${Date.now()}`,
                        role: "agent",
                        parts: [
                          {
                            kind: "text",
                            text: bestHeadline,
                          },
                        ],
                        kind: "message",
                      },
                    },
                    artifacts: [
                      {
                        artifactId: `artifact-${Date.now()}`,
                        name: "linkedinHeadlineResponse",
                        parts: [
                          {
                            kind: "text",
                            text: bestHeadline,
                          },
                        ],
                      },
                      {
                        artifactId: `data-${Date.now()}`,
                        name: "HeadlineResults",
                        parts: [
                          {
                            kind: "data",
                            data: {
                              bestHeadline: bestHeadline,
                              allHeadlines: allHeadlines,
                              topic: userText,
                              generatedAt: timestamp,
                            },
                          },
                        ],
                      },
                    ],
                  },
                };
              } else {
                // Workflow failed
                throw new Error("Workflow execution failed");
              }

              // Update the response with the correct request ID from the incoming request
              const response = {
                ...finalResult,
                id: requestId, // Ensure we use the request ID from Telex
              };

              console.log(
                "✅ [WEBHOOK] Workflow execution completed successfully"
              );
              console.log(
                "📤 [WEBHOOK] Final response:",
                JSON.stringify(response, null, 2)
              );
              console.log(`${"=".repeat(60)}\n`);

              // Return the response with correct request ID
              return new Response(JSON.stringify(response), {
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
