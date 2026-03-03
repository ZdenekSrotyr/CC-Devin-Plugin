#!/usr/bin/env node
// Self-contained MCP stdio server — no npm dependencies needed
import { createInterface } from "readline";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";

const DEVIN_API_BASE = "https://api.devin.ai/v3beta1";

// Config file — fallback when env vars are not set
const CONFIG_DIR  = `${homedir()}/.config/claude-plugins/devin`;
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;

// --- Config file ---
function configGet(key) {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return cfg[key] || null;
  } catch {
    return null;
  }
}

function configSet(token, orgId, userId) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = (() => {
    try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch { return {}; }
  })();
  const data = { ...existing, DEVIN_API_TOKEN: token, DEVIN_ORG_ID: orgId };
  if (userId) data.DEVIN_USER_ID = userId;
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function loadConfig() {
  // Priority: environment variables > config file
  // Env vars work in all environments (shell profile, Cowork settings, CI)
  return {
    token: process.env.DEVIN_API_TOKEN || configGet("DEVIN_API_TOKEN"),
    orgId: process.env.DEVIN_ORG_ID   || configGet("DEVIN_ORG_ID"),
    userId: process.env.DEVIN_USER_ID  || configGet("DEVIN_USER_ID"),
  };
}

function saveConfig(token, orgId, userId) {
  configSet(token, orgId, userId);
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
    name: "open_config_file",
    description: "Create a config file template and open it in the system editor so the user can fill in their Devin credentials without pasting them into the chat. After the user saves the file, verify with list_devin_sessions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "setup_devin",
    description: "Save Devin API credentials to ~/.config/claude-plugins/devin/config.json. Prefer open_config_file for security — use this only when the user explicitly provides credentials in chat.",
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

  // open_config_file — creates template and opens in system editor (or detects sandbox)
  if (name === "open_config_file") {
    const isSandbox = homedir().startsWith("/sessions/");

    if (isSandbox) {
      return {
        ok: false,
        is_sandbox: true,
        message: "Running in a sandboxed environment (Cowork). The config path is ephemeral and not accessible from your filesystem. Please provide your credentials in chat — they will be saved for this session via setup_devin.",
      };
    }

    mkdirSync(CONFIG_DIR, { recursive: true });
    const template = {
      DEVIN_API_TOKEN: "paste-your-token-here",
      DEVIN_ORG_ID: "paste-your-org-id-here",
      DEVIN_USER_ID: "optional-your-user-id-here",
    };
    if (!existsSync(CONFIG_PATH)) {
      writeFileSync(CONFIG_PATH, JSON.stringify(template, null, 2), { mode: 0o600 });
    }
    let opened = false;
    try {
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      execFileSync(opener, [CONFIG_PATH], { stdio: "ignore" });
      opened = true;
    } catch {
      opened = false;
    }
    return {
      ok: true,
      is_sandbox: false,
      config_path: CONFIG_PATH,
      opened_in_editor: opened,
      message: opened
        ? `Config file opened in your editor. Fill in your credentials and save, then I'll verify the connection.`
        : `Could not open editor automatically. Please open this file manually:\n${CONFIG_PATH}`,
    };
  }

  // setup_devin — saves credentials to config file
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

    const storage = `config file (${CONFIG_PATH}, mode 0600)`;

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
process.stderr.write(`[devin-mcp] started (${credStatus}${userStatus})\n`);

createInterface({ input: process.stdin }).on("line", async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      ok(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "devin-mcp", version: "0.3.6" } });
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
