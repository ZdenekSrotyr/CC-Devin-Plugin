---
description: Configure Devin API credentials
allowed-tools: mcp__plugin_devin_devin-mcp__open_config_file, mcp__plugin_devin_devin-mcp__setup_devin, mcp__plugin_devin_devin-mcp__list_devin_sessions
---

**CRITICAL: Before doing anything else**, check whether `mcp__plugin_devin_devin-mcp__open_config_file` is in your list of available tools.

**If it is NOT available:**
- Stop immediately. Do not ask for credentials.
- Tell the user exactly this:

> "The Devin MCP server is not connected to this session yet. Please restart Claude and start a new conversation, then run /devin-setup again."

That is all. Do not proceed further.

---

**If it IS available**, call `open_config_file` and follow the response:

**Branch A — `browser_opened: true`:**
Tell the user the setup page opened in their browser. They should fill in their credentials and click Save. Once they confirm it's done, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

**Branch B — `browser_opened: false`:**
Tell the user to open this URL manually in their browser:
`[setup_url from response]`

After they confirm saving, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

---

**After successful verification**: tell the user they're all set and can use `/devin`.

If `user_id` was not provided, suggest adding it for personal session filtering by re-running `/devin-setup`.

**Fallback (user explicitly provides credentials in chat):**
Call `setup_devin` with the provided token and org_id. Do not display or repeat credentials back.
