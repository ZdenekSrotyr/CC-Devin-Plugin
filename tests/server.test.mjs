#!/usr/bin/env node
/**
 * Devin plugin test suite — no external dependencies
 * Run: node tests/server.test.mjs
 */
import { spawn } from "child_process";
import { readFileSync } from "fs";
import assert from "assert";
import { resolve as resolvePath, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

// --- Test runner ---
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function parseJSON(path) {
  return JSON.parse(readFileSync(resolvePath(ROOT, path), "utf8"));
}

// ─── JSON files ────────────────────────────────────────────────────────────

console.log("\nJSON validity");

for (const file of [
  "servers/package.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".mcp.json",
]) {
  test(`${file} is valid JSON`, () => parseJSON(file));
}

// ─── Plugin metadata ───────────────────────────────────────────────────────

console.log("\nPlugin metadata");

test("plugin.json has name, version, description", () => {
  const p = parseJSON(".claude-plugin/plugin.json");
  assert.ok(p.name, "missing name");
  assert.ok(p.version, "missing version");
  assert.ok(p.description, "missing description");
  assert.match(p.version, /^\d+\.\d+\.\d+$/, "version must be semver x.y.z");
});

test("marketplace.json references plugin by name matching plugin.json", () => {
  const plugin = parseJSON(".claude-plugin/plugin.json");
  const market = parseJSON(".claude-plugin/marketplace.json");
  const names = market.plugins.map((p) => p.name);
  assert.ok(names.includes(plugin.name), `marketplace missing plugin "${plugin.name}"`);
});

test("marketplace.json version matches plugin.json version", () => {
  const plugin = parseJSON(".claude-plugin/plugin.json");
  const market = parseJSON(".claude-plugin/marketplace.json");
  const entry = market.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, `plugin "${plugin.name}" not found in marketplace`);
  assert.equal(entry.version, plugin.version,
    `marketplace has version ${entry.version}, plugin.json has ${plugin.version} — keep them in sync`);
});

test("marketplace.json has $schema field", () => {
  const market = parseJSON(".claude-plugin/marketplace.json");
  assert.ok(market["$schema"], "missing $schema — Claude Code may not recognise the marketplace");
});

test("marketplace.json has top-level description", () => {
  const market = parseJSON(".claude-plugin/marketplace.json");
  assert.ok(market.description, "missing description at marketplace level");
});

test("every plugin entry in marketplace.json has author field", () => {
  const market = parseJSON(".claude-plugin/marketplace.json");
  for (const entry of market.plugins) {
    assert.ok(entry.author?.name, `plugin "${entry.name}" is missing author.name — required by Claude Code`);
  }
});

test("servers/package.json version matches plugin.json version", () => {
  const plugin  = parseJSON(".claude-plugin/plugin.json");
  const pkg     = parseJSON("servers/package.json");
  assert.equal(pkg.version, plugin.version,
    `servers/package.json has ${pkg.version}, plugin.json has ${plugin.version}`);
});

test(".mcp.json defines devin-mcp server", () => {
  const mcp = parseJSON(".mcp.json");
  assert.ok(mcp.mcpServers?.["devin-mcp"], "missing devin-mcp server");
});

// ─── MCP server ────────────────────────────────────────────────────────────

console.log("\nMCP server");

const EXPECTED_TOOLS = [
  "setup_devin",
  "create_devin_session",
  "get_devin_session",
  "send_devin_message",
  "list_devin_sessions",
  "get_devin_stats",
];

const MESSAGES = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_devin_sessions", arguments: {} } },
  { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "setup_devin", arguments: {} } },
  { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "unknown_tool", arguments: {} } },
];

await new Promise((resolve, reject) => {
  const server = spawn("node", [resolvePath(ROOT, "servers/index.js")], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  server.stdout.on("data", (d) => { stdout += d; });
  server.stderr.on("data", (d) => { stderr += d; });

  for (const msg of MESSAGES) server.stdin.write(JSON.stringify(msg) + "\n");
  server.stdin.end();

  const timeout = setTimeout(() => {
    server.kill();
    reject(new Error("Server timed out after 5s"));
  }, 5000);

  server.on("close", () => {
    clearTimeout(timeout);
    try {
      const responses = stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const get = (id) => responses.find((r) => r.id === id);

      test("server logs startup message to stderr", () => {
        assert.ok(stderr.includes("[devin-mcp] started"), `got: ${stderr.trim()}`);
      });

      test("initialize returns protocol 2024-11-05", () => {
        const r = get(1);
        assert.ok(r, "no response");
        assert.equal(r.result.protocolVersion, "2024-11-05");
        assert.equal(r.result.serverInfo.name, "devin-mcp");
      });

      test("server version in initialize matches plugin.json version", () => {
        const r = get(1);
        assert.ok(r, "no response");
        const plugin = parseJSON(".claude-plugin/plugin.json");
        assert.equal(r.result.serverInfo.version, plugin.version,
          `serverInfo.version ${r.result.serverInfo.version} != plugin.json ${plugin.version} — update servers/index.js`);
      });

      test(`tools/list returns all ${EXPECTED_TOOLS.length} tools`, () => {
        const r = get(2);
        assert.ok(r, "no response");
        const names = r.result.tools.map((t) => t.name);
        for (const name of EXPECTED_TOOLS) {
          assert.ok(names.includes(name), `missing tool: ${name}`);
        }
      });

      test("all tools have description and inputSchema", () => {
        const r = get(2);
        for (const tool of r.result.tools) {
          assert.ok(tool.description, `${tool.name}: missing description`);
          assert.ok(tool.inputSchema, `${tool.name}: missing inputSchema`);
        }
      });

      test("list_devin_sessions returns valid response (credentials or error)", () => {
        const r = get(3);
        assert.ok(r, "no response");
        const text = r.result.content[0].text;
        // May be a raw Error string (API failure) or JSON (no-creds error or real response)
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        const isRawError = text.startsWith("Error:");
        const isJsonResponse = data !== null && (data.error || Array.isArray(data.sessions) || data.count >= 0);
        assert.ok(
          isRawError || isJsonResponse,
          `unexpected response structure: ${text.slice(0, 100)}`
        );
      });

      test("setup_devin with missing args returns error", () => {
        const r = get(4);
        assert.ok(r, "no response");
        const text = r.result.content[0].text;
        assert.ok(text.includes("required"), `unexpected: ${text}`);
      });

      test("unknown tool returns an error (not a crash)", () => {
        const r = get(5);
        assert.ok(r, "server crashed — no response to unknown tool call");
        assert.ok(r.result?.content?.[0]?.text, "response has no content");
      });

      resolve();
    } catch (e) {
      reject(e);
    }
  });
});

// ─── Summary ───────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed${failed ? `, ${failed} failed` : ""}\n`);
if (failed > 0) process.exit(1);
