---
description: Configure Devin API credentials
allowed-tools: mcp__plugin_devin_devin-mcp__setup_devin
---

**CRITICAL: Before doing anything else**, check whether `mcp__plugin_devin_devin-mcp__setup_devin` is in your list of available tools.

**If it is NOT available:**
- Stop immediately. Do not ask for credentials.
- Do not attempt to store credentials any other way (no `security` commands, no files, no env vars).
- Tell the user exactly this:

> "The Devin MCP server is not connected to this session yet. Please restart Claude and start a new conversation, then run /devin-setup again."

That is all. Do not proceed further.

---

**If it IS available**, proceed:

Tell the user that their credentials will be stored securely — in macOS Keychain on macOS, or in a user-only config file (`~/.config/claude-plugins/devin/config.json`) on Linux.

Ask for their Devin credentials using two separate questions (use AskUserQuestion tool if available, otherwise ask in chat):

1. Their **Organization ID** — found at https://app.devin.ai/settings/organization
2. Their **API Token** — found at https://app.devin.ai/settings/api-keys

Once you have both values, immediately call the `setup_devin` MCP tool with `token` and `org_id`. Do not show, log, or repeat the token back to the user at any point.

If setup_devin returns `ok: true`, tell the user they are all set and can now use /devin to delegate tasks.

If it returns an error, show the error message and ask them to double-check their credentials.
