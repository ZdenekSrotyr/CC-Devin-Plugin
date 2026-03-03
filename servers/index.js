#!/usr/bin/env node
// Self-contained MCP stdio server — no npm dependencies needed
import { createInterface } from "readline";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";

const DEVIN_API_BASE = "https://api.devin.ai/v3beta1";
const IS_MACOS = process.platform === "darwin";

// macOS Keychain entries
const KC_ACCOUNT = "devin";
const KC_TOKEN   = "claude-devin-token";
const KC_ORG     = "claude-devin-orgid";
const KC_USER    = "claude-devin-userid";

// Linux fallback: config file
const CONFIG_DIR  = `${homedir()}/.config/claude-plugins/devin`;
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;

// --- macOS Keychain ---
function keychainGet(service) {
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-a", KC_ACCOUNT, "-s", service, "-w"],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim() || null;
  } catch {
    return null;
  }
}

function keychainSet(service, value) {
  execFileSync(
    "security",
    ["add-generic-password", "-U", "-a", KC_ACCOUNT, "-s", service, "-w", value],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
}

// --- Linux config file fallback ---
function configFileGet(key) {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return cfg[key] || null;
  } catch {
    return null;
  }
}

function configFileSet(token, orgId, userId) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = (() => {
    try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch { return {}; }
  })();
  const data = { ...existing, DEVIN_API_TOKEN: token, DEVIN_ORG_ID: orgId };
  if (userId) data.DEVIN_USER_ID = userId;
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// --- Unified load/save ---
function loadConfig() {
  if (IS_MACOS) {
    // Try Keychain first; fall back to config file (e.g. sandboxed environments like Cowork)
    const token = keychainGet(KC_TOKEN) || configFileGet("DEVIN_API_TOKEN");
    const orgId = keychainGet(KC_ORG)   || configFileGet("DEVIN_ORG_ID");
    const userId = keychainGet(KC_USER) || configFileGet("DEVIN_USER_ID");
    return { token, orgId, userId };
  }
  return {
    token: configFileGet("DEVIN_API_TOKEN"),
    orgId: configFileGet("DEVIN_ORG_ID"),
    userId: configFileGet("DEVIN_USER_ID"),
  };
}

function saveConfig(token, orgId, userId) {
  if (IS_MACOS) {
    // Save to both Keychain and config file so sandboxed environments (e.g. Cowork) can read credentials
    keychainSet(KC_TOKEN, token);
    keychainSet(KC_ORG, orgId);
    if (userId) keychainSet(KC_USER, userId);
    configFileSet(token, orgId, userId);
  } else {
    configFileSet(token, orgId, userId);
  }
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
    description: "Save Devin API credentials (token and org ID) securely to macOS Keychain. Call this with the token and org_id provided by the user to complete setup.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Devin API token from app.devin.ai/settings/api-keys" },
        org_id: { type: "string", description: "Devin Organization ID from app.devin.ai/settings/organization" },
        user_id: { type: "string", description: "Optional: your Devin user_id (e.g. email|xxx) to enable personal session filtering. Can be found in session data." },
      },
      required: ["token", "org_id"],
    },
  },
  {
    name: "list_devin_sessions",
    description: "List Devin sessions. By default shows only YOUR running non-archived sessions (mine_only=true, status=[\"running\"], include_archived=false). Set status=[\"running\",\"suspended\"] or status=\"all\" for more. Always uses a limit to avoid flooding context.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max sessions to return (default 10, max 50)" },
        mine_only: { type: "boolean", description: "Filter to your own sessions only (default true). Requires user_id configured in setup. Pass false to see all users." },
        status: {
          description: "Status filter. Default [\"running\"]. Pass [\"running\",\"suspended\"] or \"all\" to widen.",
          oneOf: [
            { type: "string", enum: ["all", "running", "suspended", "stopped"] },
            { type: "array", items: { type: "string" } },
          ],
        },
        include_archived: { type: "boolean", description: "Include archived sessions (default false). Set to true to also show archived sessions." },
      },
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
  {
    name: "get_devin_stats",
    description: "Get aggregated ACU consumption statistics across Devin sessions. Optionally filter to only your own sessions.",
    inputSchema: {
      type: "object",
      properties: {
        mine_only: { type: "boolean", description: "If true, count only sessions belonging to the configured user_id" },
        limit: { type: "number", description: "Number of recent sessions to analyze (default 50)" },
      },
    },
  },
];

// --- Tool handler ---
async function callTool(name, args = {}) {

  // setup_devin — saves credentials to Keychain and verifies connection
  if (name === "setup_devin") {
    const { token, org_id, user_id } = args;
    if (!token || !org_id) {
      return { error: "Both token and org_id are required." };
    }

    // Verify credentials against Devin API
    let sessionCount = 0;
    try {
      const res = await fetch(`${DEVIN_API_BASE}/organizations/${org_id}/sessions?first=1`, {
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

    // Save credentials (Keychain on macOS, config file on Linux)
    try {
      saveConfig(token, org_id, user_id || null);
    } catch (e) {
      return { error: `Failed to save credentials: ${e.message}` };
    }

    // Reload so subsequent tool calls use new credentials
    reloadConfig();

    const storage = IS_MACOS
      ? "macOS Keychain"
      : `config file (${CONFIG_PATH}, mode 0600)`;

    const userNote = user_id
      ? ` User ID saved — personal session filtering enabled.`
      : ` No user_id provided — run setup again with user_id to enable personal filtering.`;

    return {
      ok: true,
      message: `Credentials saved to ${storage} and verified. Found ${sessionCount} session(s).${userNote}`,
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
    case "list_devin_sessions": {
      // Defaults: mine_only=true, status=["running"], limit=10, include_archived=false
      const mineOnly = args.mine_only !== false;
      const limit = Math.min(args.limit || 10, 50);
      const statusArg = args.status ?? ["running"];
      const statusFilter = statusArg === "all" ? null
                         : Array.isArray(statusArg) ? statusArg : [statusArg];
      const includeArchived = args.include_archived === true;

      // Require user_id when mine_only (default)
      if (mineOnly && !config.userId) {
        return { error: "user_id not configured. Run /devin-setup and provide your user_id, or pass mine_only=false to list all users' sessions." };
      }

      // Fetch more from API to account for client-side filtering (status + archived)
      const fetchLimit = (statusFilter || !includeArchived) ? Math.min(limit * 5, 200) : limit;
      let url = `/organizations/${orgId}/sessions?first=${fetchLimit}`;
      if (mineOnly) url += `&user_ids=${encodeURIComponent(config.userId)}`;

      const data = await devinRequest("GET", url);
      let sessions = Array.isArray(data.items) ? data.items
                   : Array.isArray(data.sessions) ? data.sessions
                   : Array.isArray(data.data) ? data.data : [];

      // Filter out archived sessions unless include_archived=true
      if (!includeArchived) {
        sessions = sessions.filter((s) => !s.is_archived);
      }

      // Client-side status filter (API doesn't support it server-side)
      if (statusFilter) {
        sessions = sessions.filter((s) => statusFilter.includes(s.status));
      }
      sessions = sessions.slice(0, limit);

      const result = sessions.map((s) => ({
        session_id: s.session_id,
        title: s.title || "(no title)",
        status: s.status,
        status_detail: s.status_detail,
        acus_consumed: s.acus_consumed ?? null,
        created_at: s.created_at,
        url: s.url,
      }));

      const totalAcus = result.reduce((sum, s) => sum + (s.acus_consumed || 0), 0);
      return { sessions: result, total_acus_consumed: totalAcus, count: result.length };
    }

    case "create_devin_session":
      return devinRequest("POST", `/organizations/${orgId}/sessions`, {
        prompt: args.prompt,
        ...(args.idempotent_client_id && { idempotent_client_id: args.idempotent_client_id }),
      });

    case "get_devin_session": {
      const data = await devinRequest("GET", `/organizations/${orgId}/sessions?session_ids=${args.session_id}&first=1`);
      const session = (data.items || [])[0];
      if (!session) return { error: `Session ${args.session_id} not found.` };
      return session;
    }

    case "send_devin_message":
      return devinRequest("POST", `/organizations/${orgId}/sessions/${args.session_id}/messages`, {
        message: args.message,
      });

    case "get_devin_stats": {
      const mineOnly = args.mine_only === true;
      const limit = args.limit || 50;

      let url = `/organizations/${orgId}/sessions?first=${limit}`;
      if (mineOnly) {
        if (!config.userId) {
          return { error: "mine_only=true requires user_id to be configured. Run /devin-setup and provide your user_id." };
        }
        url += `&user_ids=${encodeURIComponent(config.userId)}`;
      }

      const data = await devinRequest("GET", url);
      let sessions = Array.isArray(data.items) ? data.items
                   : Array.isArray(data.sessions) ? data.sessions
                   : Array.isArray(data.data) ? data.data : [];

      // Filter out archived sessions (same default as list_devin_sessions)
      sessions = sessions.filter((s) => !s.is_archived);

      const totalAcus = sessions.reduce((sum, s) => sum + (s.acus_consumed || 0), 0);
      const byStatus = sessions.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      const acusByUser = {};
      for (const s of sessions) {
        const uid = s.user_id || "unknown";
        acusByUser[uid] = (acusByUser[uid] || 0) + (s.acus_consumed || 0);
      }

      return {
        sessions_analyzed: sessions.length,
        total_acus_consumed: totalAcus,
        sessions_by_status: byStatus,
        acus_by_user: mineOnly ? undefined : acusByUser,
        filter: mineOnly ? `user_id=${config.userId}` : "all users",
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- MCP JSON-RPC stdio ---
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const ok  = (id, result) => send({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

const credStatus = (config.token && config.orgId) ? "credentials found" : "no credentials — run /devin-setup";
const userStatus = config.userId ? `, user=${config.userId}` : "";
process.stderr.write(`[devin-mcp] started (${IS_MACOS ? "macOS" : "Linux"}, ${credStatus}${userStatus})\n`);

createInterface({ input: process.stdin }).on("line", async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      ok(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "devin-mcp", version: "0.3.2" } });
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
