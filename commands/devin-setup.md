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

**If it IS available**, proceed with the secure setup flow:

1. Call `open_config_file`. This creates a config file template at `~/.config/claude-plugins/devin/config.json` and tries to open it in the system editor.

2. Tell the user:
   - The file has been created/opened with placeholder values
   - They need to fill in their credentials **directly in the file** — not in the chat
   - Where to find them:
     - **API Token** — https://app.devin.ai/settings/api-keys
     - **Organization ID** — https://app.devin.ai/settings/organization
     - **User ID** (optional, format `email|xxx`) — visible in session details, enables personal filtering
   - After saving the file, tell Claude to continue

3. Once the user confirms they've saved the file, call `list_devin_sessions` with `status="all"` and `limit=1` as a verification check.
   - If it returns sessions or an empty list → credentials are valid, setup complete
   - If it returns an auth error → ask the user to double-check their token and org ID in the config file

4. If verification succeeds, tell the user they're all set and can use `/devin` to delegate tasks.

**Fallback (user insists on providing credentials in chat):**
If the user explicitly provides their token and org_id in the message, call `setup_devin` with those values. Do not show, log, or repeat the token back.
