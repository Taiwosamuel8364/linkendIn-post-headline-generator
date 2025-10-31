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
            try {
              // Try to parse the body in different ways
              let body;

              console.log("Request type:", typeof request);

              // Try to get the raw request if it's wrapped
              const rawReq = request.raw || request.req || request;

              // Try the req property first (might be the actual HTTP request)
              if (request.req && typeof request.req.body !== "undefined") {
                console.log("Using request.req.body");
                body = request.req.body;
              }
              // Try parseBody if available
              else if (typeof request.parseBody === "function") {
                console.log("Using request.parseBody()");
                body = await request.parseBody();
              }
              // Try to read the raw body text and parse it
              else if (rawReq && typeof rawReq.text === "function") {
                console.log("Using rawReq.text()");
                try {
                  const textContent = await rawReq.text();
                  console.log("Raw text content:", textContent);
                  body = textContent ? JSON.parse(textContent) : {};
                } catch (e) {
                  console.error("Failed to parse text:", e);
                  body = {};
                }
              }
              // Hono c.req.json() pattern
              else if (request.req && typeof request.req.json === "function") {
                console.log("Using request.req.json()");
                body = await request.req.json();
              } else {
                console.log("Unknown request format, trying request.json()");
                body = {};
              }

              console.log("Parsed body:", JSON.stringify(body, null, 2));

              // Validate that we have the required fields
              if (!body.text) {
                console.error("Missing text field. Body:", body);
                return new Response(
                  JSON.stringify(
                    {
                      error: "Missing required field: text",
                      received: body,
                      hint: 'Send POST request with JSON body: {"text":"Your Topic","tone":"professional"}',
                    },
                    null,
                    2
                  ),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              // Get the workflow and create a run instance
              const workflow = mastra.getWorkflow("linkedinHeadlineWorkflow");
              const run = await workflow.createRunAsync();

              // Execute the workflow
              const result = await run.start({
                inputData: body,
              });

              return new Response(JSON.stringify(result, null, 2), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              console.error("Workflow execution error:", error);
              return new Response(
                JSON.stringify({
                  error: "Failed to execute workflow",
                  message:
                    error instanceof Error ? error.message : "Unknown error",
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
