---
description: Configure Devin API credentials
allowed-tools: mcp__plugin_devin_devin-mcp__setup_devin
---

**Before doing anything else**, check whether the `setup_devin` tool is available in your current session.

If `mcp__plugin_devin_devin-mcp__setup_devin` is NOT in your available tools, stop immediately and tell the user:

> "The Devin MCP server is not connected to this session yet. This usually means the plugin was just installed and Claude hasn't been restarted yet. Please restart Claude and run /devin-setup again."

Do not ask for credentials if the tool is unavailable — there is nowhere to store them.

---

If the tool IS available, proceed:

Tell the user that their credentials will be stored securely — in macOS Keychain on macOS, or in a user-only config file (`~/.config/claude-plugins/devin/config.json`) on Linux.

Ask for their Devin credentials using two separate questions (use AskUserQuestion tool if available, otherwise ask in chat):

1. Their **Organization ID** — found at https://app.devin.ai/settings/organization
2. Their **API Token** — found at https://app.devin.ai/settings/api-keys

Once you have both values, immediately call the `setup_devin` MCP tool with `token` and `org_id`. Do not show, log, or repeat the token back to the user at any point.

If setup_devin returns `ok: true`, tell the user they are all set and can now use /devin to delegate tasks.

If it returns an error, show the error message and ask them to double-check their credentials.
