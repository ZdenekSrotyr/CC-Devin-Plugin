#!/usr/bin/env node
/**
 * Devin Plugin Setup Server
 * Starts a local web server, opens your browser, and lets you
 * enter API credentials through a nice UI form.
 * No npm dependencies required — pure Node.js CommonJS.
 */

"use strict";
const { createServer } = require("http");
const { writeFileSync, mkdirSync, existsSync, readFileSync } = require("fs");
const { homedir } = require("os");
const { execSync } = require("child_process");

const PORT = 3747;
const CONFIG_DIR = `${homedir()}/.config/claude-plugins/devin`;
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;
const DEVIN_API_BASE = "https://api.devin.ai/v3beta1";

// Load existing config if present
function loadExisting() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch {}
  }
  return {};
}

const HTML = (existing) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Devin Plugin Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d10;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #16161e;
      border: 1px solid #2d2d3d;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
    }
    .logo-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #7c6aff, #5e4fff);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .logo-text h1 { font-size: 20px; font-weight: 700; color: #f0f0ff; }
    .logo-text p { font-size: 13px; color: #666680; margin-top: 2px; }
    .field { margin-bottom: 20px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #a0a0c0;
      margin-bottom: 8px;
    }
    .input-wrap { position: relative; }
    input {
      width: 100%;
      background: #0d0d10;
      border: 1px solid #2d2d3d;
      border-radius: 10px;
      padding: 12px 44px 12px 16px;
      color: #e2e8f0;
      font-size: 14px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #5e4fff; box-shadow: 0 0 0 3px rgba(94,79,255,0.15); }
    .toggle-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #666680;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
    }
    .toggle-btn:hover { color: #a0a0c0; }
    .hint { margin-top: 6px; font-size: 12px; color: #555570; }
    .hint a { color: #7c6aff; text-decoration: none; }
    .hint a:hover { text-decoration: underline; }
    .already-set { font-size: 11px; color: #5e4fff; margin-left: 6px; font-weight: 500; }
    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #7c6aff, #5e4fff);
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      margin-top: 20px;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 14px;
      display: none;
      align-items: flex-start;
      gap: 10px;
    }
    .status.show { display: flex; }
    .status.testing { background: #1a1a2e; border: 1px solid #2d2d4d; color: #8888bb; }
    .status.success { background: #0d1f0d; border: 1px solid #1a4d1a; color: #4caf50; }
    .status.error { background: #1f0d0d; border: 1px solid #4d1a1a; color: #ef5350; }
    .status-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .status-body { flex: 1; }
    .status-title { font-weight: 600; margin-bottom: 4px; }
    .status-detail { font-size: 12px; opacity: 0.8; line-height: 1.5; }
    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid #5e4fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      flex-shrink: 0;
      margin-top: 3px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .divider { border: none; border-top: 1px solid #2d2d3d; margin: 28px 0; }
    .footer { font-size: 12px; color: #44445a; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      <div class="logo-text">
        <h1>Devin Plugin</h1>
        <p>API Credentials Setup</p>
      </div>
    </div>

    <div class="field">
      <label>
        DEVIN API TOKEN
        ${existing.DEVIN_API_TOKEN ? '<span class="already-set">✓ already set</span>' : ''}
      </label>
      <div class="input-wrap">
        <input type="password" id="token"
          placeholder="${existing.DEVIN_API_TOKEN ? '••••••••••••••••' : 'devin_api_...'}"
          autocomplete="off" spellcheck="false" />
        <button class="toggle-btn" onclick="toggleVis('token',this)" type="button">👁</button>
      </div>
      <div class="hint">
        <a href="https://app.devin.ai/settings/api-keys" target="_blank">app.devin.ai → Settings → API Keys</a>
      </div>
    </div>

    <div class="field">
      <label>
        ORGANIZATION ID
        ${existing.DEVIN_ORG_ID ? '<span class="already-set">✓ already set</span>' : ''}
      </label>
      <div class="input-wrap">
        <input type="text" id="orgId"
          placeholder="${existing.DEVIN_ORG_ID || 'org_xxxxxxxxxxxxxxxxxx'}"
          value="${existing.DEVIN_ORG_ID || ''}"
          autocomplete="off" spellcheck="false" />
      </div>
      <div class="hint">
        <a href="https://app.devin.ai/settings/organization" target="_blank">app.devin.ai → Settings → Organization</a>
      </div>
    </div>

    <button class="btn" id="saveBtn" onclick="save()">Save &amp; Verify Connection</button>
    <div class="status" id="status"></div>

    <hr class="divider">
    <div class="footer">
      Credentials saved locally to<br>
      <code>~/.config/claude-plugins/devin/config.json</code>
    </div>
  </div>

  <script>
    const hasExistingToken = ${!!existing.DEVIN_API_TOKEN};

    function toggleVis(id, btn) {
      const el = document.getElementById(id);
      el.type = el.type === 'password' ? 'text' : 'password';
      btn.textContent = el.type === 'password' ? '👁' : '🙈';
    }

    function showStatus(type, title, detail) {
      const el = document.getElementById('status');
      const icons = { success: '✓', error: '✗' };
      el.className = 'status show ' + type;
      el.innerHTML =
        (type === 'testing' ? '<div class="spinner"></div>' : '<div class="status-icon">' + icons[type] + '</div>') +
        '<div class="status-body"><div class="status-title">' + title + '</div>' +
        (detail ? '<div class="status-detail">' + detail + '</div>' : '') + '</div>';
    }

    async function save() {
      const token = document.getElementById('token').value.trim();
      const orgId = document.getElementById('orgId').value.trim();

      if (!token && !hasExistingToken) {
        showStatus('error', 'API Token is required', 'Enter your Devin API token.');
        return;
      }
      if (!orgId) {
        showStatus('error', 'Organization ID is required', 'Enter your Devin Organization ID.');
        return;
      }

      document.getElementById('saveBtn').disabled = true;
      showStatus('testing', 'Saving and verifying…', 'Testing connection to Devin API...');

      try {
        const res = await fetch('/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token || undefined, orgId })
        });
        const data = await res.json();
        if (data.ok) {
          showStatus('success', 'Connected!',
            'Found ' + data.sessionCount + ' session(s). Credentials saved.\\nRestart Claude to apply.');
          document.getElementById('saveBtn').textContent = '✓ Saved — restart Claude';
        } else {
          showStatus('error', 'Verification failed', data.error || 'Check your credentials.');
          document.getElementById('saveBtn').disabled = false;
        }
      } catch (e) {
        showStatus('error', 'Request failed', e.message);
        document.getElementById('saveBtn').disabled = false;
      }
    }
  </script>
</body>
</html>`;

async function testDevinAPI(token, orgId) {
  const res = await fetch(`${DEVIN_API_BASE}/organizations/${orgId}/sessions?limit=1`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data.sessions) ? data.sessions.length : (data.data?.length ?? 0);
}

const existing = loadExisting();

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML(existing));
    return;
  }

  if (req.method === "POST" && req.url === "/setup") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { token, orgId } = JSON.parse(body);
        const finalToken = token || existing.DEVIN_API_TOKEN;
        const finalOrgId = orgId || existing.DEVIN_ORG_ID;

        if (!finalToken || !finalOrgId) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing token or org ID." }));
          return;
        }

        let sessionCount = 0;
        try {
          sessionCount = await testDevinAPI(finalToken, finalOrgId);
        } catch (err) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: err.message }));
          return;
        }

        mkdirSync(CONFIG_DIR, { recursive: true });
        writeFileSync(CONFIG_PATH, JSON.stringify({
          DEVIN_API_TOKEN: finalToken,
          DEVIN_ORG_ID: finalOrgId
        }, null, 2), { mode: 0o600 });

        try {
          execSync(`launchctl setenv DEVIN_API_TOKEN "${finalToken}"`);
          execSync(`launchctl setenv DEVIN_ORG_ID "${finalOrgId}"`);
        } catch (_) {}

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, sessionCount }));

        setTimeout(() => { server.close(); process.exit(0); }, 1500);
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nDevin Setup UI: http://localhost:${PORT}\n`);
  try { execSync(`open http://localhost:${PORT}`); } catch (_) {
    try { execSync(`xdg-open http://localhost:${PORT}`); } catch (_) {}
  }
});
