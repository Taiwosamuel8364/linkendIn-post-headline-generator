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
            console.log(`📨 [WEBHOOK] New request received at ${timestamp}`);
            console.log(`${"=".repeat(60)}`);

            try {
              // Try to parse the body in different ways
              let body;

              console.log("Request type:", typeof request);

              // Try to get the raw request if it's wrapped
              const rawReq = request.raw || request.req || request;

              // Method 1: Try request.text() first (Hono-style)
              if (typeof rawReq.text === "function") {
                console.log("Using request.text()");
                const textBody = await rawReq.text();
                console.log("Raw text body:", textBody);
                body = JSON.parse(textBody);
              }
              // Method 2: Try request.body (if it exists)
              else if (rawReq.body) {
                console.log("Using request.body");
                body = rawReq.body;
              }
              // Method 3: Try reading from a stream
              else if (rawReq.on) {
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
                "📥 [WEBHOOK] Parsed request body:",
                JSON.stringify(body, null, 2)
              );

              if (!body || !body.text) {
                console.log(
                  "❌ [WEBHOOK] Error: Missing required field 'text'"
                );
                console.log("Received body:", JSON.stringify(body, null, 2));
                return new Response(
                  JSON.stringify({
                    error: "Missing required field: text",
                    hint: 'Send POST request with JSON body: {"text":"Your Topic","tone":"professional"}',
                    received: body,
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              console.log("🚀 [WEBHOOK] Starting workflow execution...");

              // Get the workflow and execute it
              const workflow = mastra.getWorkflow("linkedinHeadlineWorkflow");
              const run = await workflow.createRunAsync();
              const result = await run.start({ inputData: body });

              console.log(
                "✅ [WEBHOOK] Workflow execution completed successfully"
              );
              console.log(
                "📤 [WEBHOOK] Response:",
                JSON.stringify(result, null, 2)
              );
              console.log(`${"=".repeat(60)}\n`);

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
                  error: "Failed to execute workflow",
                  message:
                    error instanceof Error ? error.message : String(error),
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
