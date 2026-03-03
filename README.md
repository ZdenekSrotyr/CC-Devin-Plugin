# Devin Plugin

Delegate coding tasks to [Devin AI](https://app.devin.ai) directly from Claude. Devin acts as a sub-agent — Claude orchestrates, Devin executes deep software engineering work.

## What's included

| Component | Description |
|-----------|-------------|
| `/devin` command | Assign a task to Devin |
| `/devin-setup` command | Save your API credentials |
| `devin-orchestration` skill | Guides Claude on when and how to use Devin |
| `devin-mcp` server | Wraps the Devin API with MCP tools |

## Installation

```bash
/plugin marketplace add ZdenekSrotyr/CC-Devin-Plugin
/plugin install devin@devin
```

Then restart Claude.

## Setup

Run `/devin-setup` in a new conversation. Credentials are **never required in chat**.

You'll need:
- **API Token** — [app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys)
- **Organization ID** — [app.devin.ai/settings/organization](https://app.devin.ai/settings/organization)

Credentials are saved to **macOS Keychain** (primary) and `~/.config/claude-plugins/devin/config.json` (fallback for Linux).

### Alternative — Environment variables

Add to `~/.zshrc` or `~/.zprofile`:

```sh
export DEVIN_API_TOKEN="your-token"
export DEVIN_ORG_ID="your-org-id"
export DEVIN_USER_ID="your-user-id"   # optional, enables personal filtering
```

Restart Claude after saving.

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
| `open_config_file` | Open setup form in browser (secure — no credentials in chat) |
| `setup_devin` | Save API credentials programmatically |
| `create_devin_session` | Start a new Devin task |
| `get_devin_session` | Check status of a session |
| `send_devin_message` | Send follow-up message to Devin |
| `list_devin_sessions` | List recent sessions |
| `get_devin_stats` | Get ACU consumption statistics |

## Removing credentials

```bash
# macOS Keychain
security delete-generic-password -a devin -s claude-devin-token
security delete-generic-password -a devin -s claude-devin-orgid
security delete-generic-password -a devin -s claude-devin-userid

# Config file
rm ~/.config/claude-plugins/devin/config.json
```
