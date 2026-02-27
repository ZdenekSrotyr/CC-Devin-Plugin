#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const DEVIN_API_BASE = "https://api.cognition.ai/v1";
const token = process.env.DEVIN_API_TOKEN;

if (!token) {
  process.stderr.write("Error: DEVIN_API_TOKEN environment variable is not set\n");
  process.exit(1);
}

// --- API helper ---
async function devinRequest(method, path, body = null) {
  const response = await fetch(`${DEVIN_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Devin API ${response.status}: ${text}`);
  }
  return response.json();
}

// --- Tool definitions ---
const tools = [
  {
    name: "create_devin_session",
    description:
      "Start a new Devin AI session with a task. Returns session_id and a URL to watch Devin work. Use this when delegating a coding task to Devin.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The full task description for Devin. Be specific — include repo, files, and expected outcome.",
        },
        idempotent_client_id: {
          type: "string",
          description: "Optional unique ID to prevent creating duplicate sessions for the same task.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_devin_session",
    description:
      "Get the current status and details of a Devin session. Use this to check if Devin has finished a task.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The Devin session ID returned from create_devin_session.",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "send_devin_message",
    description:
      "Send a follow-up message or clarification to an active Devin session. Use this to give Devin additional instructions mid-task.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "The Devin session ID.",
        },
        message: {
          type: "string",
          description: "The message or instruction to send to Devin.",
        },
      },
      required: ["session_id", "message"],
    },
  },
  {
    name: "list_devin_sessions",
    description:
      "List recent Devin sessions with their statuses. Useful for getting an overview of ongoing or past tasks.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of sessions to return. Defaults to 10.",
        },
      },
    },
  },
];

// --- MCP server ---
const server = new Server(
  { name: "devin-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "create_devin_session":
        result = await devinRequest("POST", "/sessions", {
          prompt: args.prompt,
          ...(args.idempotent_client_id && {
            idempotent_client_id: args.idempotent_client_id,
          }),
        });
        break;

      case "get_devin_session":
        result = await devinRequest("GET", `/session/${args.session_id}`);
        break;

      case "send_devin_message":
        result = await devinRequest(
          "POST",
          `/session/${args.session_id}/message`,
          { message: args.message }
        );
        break;

      case "list_devin_sessions":
        result = await devinRequest(
          "GET",
          `/sessions?limit=${args.limit || 10}`
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
