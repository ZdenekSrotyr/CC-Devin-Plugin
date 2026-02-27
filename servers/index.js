#!/usr/bin/env node
// Self-contained MCP stdio server — no npm dependencies needed
import { createInterface } from "readline";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";

const DEVIN_API_BASE = "https://api.devin.ai/v3beta1";
const CONFIG_DIR = `${homedir()}/.config/claude-plugins/devin`;
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;

// Load credentials: env vars first, then config file fallback
function loadConfig() {
  let token = process.env.DEVIN_API_TOKEN;
  let orgId = process.env.DEVIN_ORG_ID;

  if (!token || !orgId) {
    if (existsSync(CONFIG_PATH)) {
      try {
        const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
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
    description: "Save Devin API credentials (token and org ID) to the local config file. Call this with the token and org_id provided by the user to complete setup.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Devin API token from app.devin.ai/settings/api-keys" },
        org_id: { type: "string", description: "Devin Organization ID from app.devin.ai/settings/organization" },
      },
      required: ["token", "org_id"],
    },
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

  // setup_devin — saves credentials and verifies connection
  if (name === "setup_devin") {
    const { token, org_id } = args;
    if (!token || !org_id) {
      return { error: "Both token and org_id are required." };
    }

    // Verify credentials against Devin API
    let sessionCount = 0;
    try {
      const res = await fetch(`${DEVIN_API_BASE}/organizations/${org_id}/sessions?limit=1`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { error: `API verification failed (HTTP ${res.status}): ${body.slice(0, 200)}` };
      }
      const data = await res.json();
      sessionCount = Array.isArray(data.sessions) ? data.sessions.length : (data.data?.length ?? 0);
    } catch (e) {
      return { error: `Connection failed: ${e.message}` };
    }

    // Save to config file
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify({
        DEVIN_API_TOKEN: token,
        DEVIN_ORG_ID: org_id,
      }, null, 2), { mode: 0o600 });
    } catch (e) {
      return { error: `Failed to save config: ${e.message}` };
    }

    // Reload so subsequent tool calls use new credentials
    reloadConfig();

    return {
      ok: true,
      message: `✅ Credentials saved and verified! Found ${sessionCount} session(s). You're ready to use Devin.`,
    };
  }

  // All other tools require credentials — try reloading first
  if (!config.token || !config.orgId) {
    reloadConfig();
  }
  if (!config.token || !config.orgId) {
    return {
      error: "Devin credentials not configured. Run /devin-setup to configure.",
    };
  }

  const { orgId } = config;
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
