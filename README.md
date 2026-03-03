# Devin Plugin

Delegate coding tasks to [Devin AI](https://app.devin.ai) directly from Claude. Devin acts as a sub-agent — Claude orchestrates, Devin executes deep software engineering work.

## What's included

| Component | Description |
|-----------|-------------|
| `/devin` command | Assign a task to Devin |
| `/devin-setup` command | Save your API credentials |
| `devin-orchestration` skill | Guides Claude on when and how to use Devin |
| `devin-mcp` server | Wraps the Devin API with MCP tools |

## How it works

The `devin-mcp` server runs as a **local HTTP/SSE process on your Mac** (outside any sandbox).
Claude Code connects to it via `type: sse` in `.mcp.json`. This means:

- Cowork sandbox doesn't block API calls (the server runs on the host, not inside the sandbox)
- Other Claude Code environments work the same way
- The server must be running before you open Claude/Cowork

## Installation

```bash
/plugin marketplace add ZdenekSrotyr/CC-Devin-Plugin
/plugin install devin@devin
```

Then **start the server** (see Setup below) and restart Claude/Cowork.

## Setup

### Step 1 — Start the MCP server

#### Option A — macOS LaunchAgent (recommended: auto-starts at login)

```bash
cd ~/.claude/plugins/devin/servers
bash install-launchagent.sh
```

The server will start immediately and restart automatically at every login.

Verify it's running:
```bash
curl http://127.0.0.1:3742/health
# → {"ok":true,"server":"devin-mcp","version":"0.4.0"}
```

#### Option B — Manual start (one-off)

```bash
cd ~/.claude/plugins/devin/servers
node index.js
# or: npm start
```

Keep this terminal open (or run it with `nohup node index.js &`).

#### Custom port

Set `MCP_PORT` to use a different port:
```bash
MCP_PORT=4000 node index.js
```
Then also update the URL in `.mcp.json` accordingly.

### Step 2 — Configure credentials

Run `/devin-setup` in a new conversation. Credentials are **never required in chat**.

You'll need:
- **API Token** — [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys)
- **Organization ID** — [app.devin.ai/settings/organization](https://app.devin.ai/settings/organization)

Credentials are saved to `~/.config/claude-plugins/devin/config.json` (mode 0600).
Alternatively, set environment variables in `~/.zshrc` / `~/.zprofile`:

```sh
export DEVIN_API_TOKEN="your-token"
export DEVIN_ORG_ID="your-org-id"
export DEVIN_USER_ID="your-user-id"   # optional, enables personal filtering
```

## Usage

```
/devin Fix the login bug in github.com/myorg/myapp — login fails for uppercase emails
```

Or natural language:
- "Deleguj tohle Devinovi"
- "Ať to Devin opraví"
- "Zkontroluj, co Devin dělá"

## Available MCP tools

| Tool | Description |
|------|-------------|
| `open_config_file` | Open config file in editor (secure setup — no credentials in chat) |
| `setup_devin` | Save API credentials programmatically |
| `create_devin_session` | Start a new Devin task |
| `get_devin_session` | Check status of a session |
| `send_devin_message` | Send follow-up message to Devin |
| `list_devin_sessions` | List recent sessions |
| `get_devin_stats` | Get ACU consumption statistics |

## Managing the LaunchAgent

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/com.claude.devin-mcp.plist

# Start
launchctl load -w ~/Library/LaunchAgents/com.claude.devin-mcp.plist

# View logs
tail -f /tmp/devin-mcp.log

# Uninstall
launchctl unload ~/Library/LaunchAgents/com.claude.devin-mcp.plist
rm ~/Library/LaunchAgents/com.claude.devin-mcp.plist
```

## Removing credentials

```bash
rm ~/.config/claude-plugins/devin/config.json
```
