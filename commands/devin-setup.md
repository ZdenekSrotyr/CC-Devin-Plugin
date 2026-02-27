---
description: Configure Devin API credentials
allowed-tools: mcp__plugin_devin_devin-mcp__setup_devin
---

Ask the user for their Devin credentials using two separate questions (use AskUserQuestion tool if available, otherwise ask in chat):

1. Their **Organization ID** — found at https://app.devin.ai/settings/organization
2. Their **API Token** — found at https://app.devin.ai/settings/api-keys

Once you have both values, immediately call the `setup_devin` MCP tool with `token` and `org_id`. Do not show or repeat the token back to the user.

If setup_devin returns `ok: true`, tell the user they are all set and can now use /devin to delegate tasks.
If it returns an error, show the error and ask them to double-check their credentials.
