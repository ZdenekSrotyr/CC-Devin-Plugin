#!/usr/bin/env node
// Self-contained MCP stdio server — no npm dependencies needed
import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { spawn } from "child_process";

const DEVIN_API_BASE = "https://api.devin.ai/v3beta1";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load credentials: env vars first, then config file fallback
// Does NOT exit — returns nulls so the server can still start and offer setup tool
function loadConfig() {
  let token = process.env.DEVIN_API_TOKEN;
  let orgId = process.env.DEVIN_ORG_ID;

  if (!token || !orgId) {
    const configPath = `${homedir()}/.config/claude-plugins/devin/config.json`;
    if (existsSync(configPath)) {
      try {
        const cfg = JSON.parse(readFileSync(configPath, "utf8"));
        token = token || cfg.DEVIN_API_TOKEN;
        orgId = orgId || cfg.DEVIN_ORG_ID;
      } catch (e) {
        process.stderr.write(`Warning: Could not read config file: ${e.message}\n`);
      }
    }
  }

  return { token: token || null, orgId: orgId || null };
}

let config = loadConfig();

// Reload credentials from disk (called after setup completes)
function reloadConfig() {
  config = loadConfig();
}

// --- Devin API helper ---
async function devinRequest(method, path, body = null) {
  const res = await fetch(`${DEVIN_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Devin API ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- Tool definitions ---
const TOOLS = [
  {
    name: "setup_devin",
    description: "Launch an interactive browser UI to configure Devin API credentials. Opens http://localhost:3747 automatically.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_devin_sessions",
    description: "List recent Devin sessions with their statuses.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Max sessions to return (default 10)" } },
    },
  },
  {
    name: "create_devin_session",
    description: "Start a new Devin AI session with a task. Returns session_id and URL to watch live.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task for Devin. Be specific — include repo, files, expected outcome." },
        idempotent_client_id: { type: "string", description: "Optional dedup ID" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_devin_session",
    description: "Get status and details of a Devin session.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string", description: "Devin session ID" } },
      required: ["session_id"],
    },
  },
  {
    name: "send_devin_message",
    description: "Send a follow-up message to an active Devin session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Devin session ID" },
        message: { type: "string", description: "Message to send to Devin" },
      },
      required: ["session_id", "message"],
    },
  },
];

// --- Tool handler ---
async function callTool(name, args = {}) {
  // setup_devin — works even without credentials
  if (name === "setup_devin") {
    const setupScript = join(__dirname, "..", "scripts", "setup-server.js");
    if (!existsSync(setupScript)) {
      return { error: "setup-server.js not found. Please reinstall the plugin." };
    }
    // Spawn detached so it outlives this process; open browser automatically
    const child = spawn("node", [setupScript], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return {
      message: "✅ Setup UI launched! Your browser should open automatically to http://localhost:3747\n\nEnter your Devin API Token and Organization ID in the form. After saving, run /devin-setup again or retry your command.",
    };
  }

  // All other tools require credentials
  if (!config.token || !config.orgId) {
    // Try reloading in case user just completed setup
    reloadConfig();
  }
  if (!config.token || !config.orgId) {
    return {
      error: "Devin credentials not configured. Call the setup_devin tool to open the browser setup UI.",
    };
  }

  const { token, orgId } = config;
  switch (name) {
    case "list_devin_sessions":
      return devinRequest("GET", `/organizations/${orgId}/sessions?limit=${args.limit || 10}`);
    case "create_devin_session":
      return devinRequest("POST", `/organizations/${orgId}/sessions`, {
        prompt: args.prompt,
        ...(args.idempotent_client_id && { idempotent_client_id: args.idempotent_client_id }),
      });
    case "get_devin_session":
      return devinRequest("GET", `/organizations/${orgId}/sessions/${args.session_id}`);
    case "send_devin_message":
      return devinRequest("POST", `/organizations/${orgId}/sessions/${args.session_id}/messages`, {
        message: args.message,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- MCP JSON-RPC stdio ---
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const ok  = (id, result) => send({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

createInterface({ input: process.stdin }).on("line", async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      ok(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "devin-mcp", version: "0.1.0" } });
    } else if (method === "tools/list") {
      ok(id, { tools: TOOLS });
    } else if (method === "tools/call") {
      try {
        const result = await callTool(params.name, params.arguments);
        ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        ok(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
      }
    } else if (method === "notifications/initialized") {
      // no response needed
    } else {
      err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    err(id, -32603, e.message);
  }
});
