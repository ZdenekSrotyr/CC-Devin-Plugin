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

**If it IS available**, call `open_config_file` first and follow the branch based on the response:

---

**Branch A — `is_sandbox: true` (Cowork or other sandboxed environment):**

Tell the user:

> "You're in a sandboxed environment (Cowork). The safest way to provide credentials is via **environment variables** — they're set once in your shell profile and never appear in chat.
>
> Add these lines to your `~/.zshrc` (or `~/.zprofile`):
>
> ```sh
> export DEVIN_API_TOKEN="your-token-here"
> export DEVIN_ORG_ID="your-org-id-here"
> export DEVIN_USER_ID="your-user-id-here"   # optional
> ```
>
> Where to find them:
> - **API Token** → app.devin.ai/settings/api-keys
> - **Organization ID** → app.devin.ai/settings/organization
> - **User ID** (optional, format `email|xxx`) → visible in session details
>
> After saving the file, restart Cowork so the new environment is picked up. Then run `/devin-setup` again to verify."

Do NOT ask for credentials in chat. Do NOT proceed further until the user confirms they've set the env vars and restarted.

---

**Branch B — `opened_in_editor: true` (normal environment, editor opened):**

Tell the user their config file is open in the editor. They should:
1. Replace the placeholder values with their real credentials
2. Save the file
3. Tell Claude when done

After they confirm, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

---

**Branch C — `opened_in_editor: false`, `is_sandbox: false` (normal env, editor failed):**

Tell the user to open this file manually and fill in their credentials:
`~/.config/claude-plugins/devin/config.json`

After they confirm, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

---

**After successful verification** (branches B or C): tell the user they're all set and can use `/devin`.

If `user_id` was not provided, suggest adding it for personal session filtering.
