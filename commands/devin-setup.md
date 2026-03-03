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

**Branch A — `is_sandbox: true` (Cowork or other sandboxed environment):**

Tell the user:
> "You're running in a sandboxed environment (Cowork). The filesystem here is isolated and temporary, so credentials need to be provided directly. They'll be encrypted in transit and stored only for this session's config.
>
> Please share your credentials — I'll write them to the config file immediately and won't display them back.
>
> - **API Token** → app.devin.ai/settings/api-keys
> - **Organization ID** → app.devin.ai/settings/organization
> - **User ID** (optional, format `email|xxx`) → visible in session details"

Once the user provides token and org_id, call `setup_devin`. Do not repeat or display the credentials.

**Branch B — `opened_in_editor: true` (normal environment, editor opened):**

Tell the user their config file is open in the editor. They should:
1. Replace the placeholder values with their real credentials
2. Save the file
3. Tell Claude when done

After they confirm, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

**Branch C — `opened_in_editor: false`, `is_sandbox: false` (normal env, editor failed):**

Tell the user to open this file manually and fill in their credentials:
`~/.config/claude-plugins/devin/config.json`

After they confirm, call `list_devin_sessions` with `status="all"` and `limit=1` to verify.

---

**After successful verification** (any branch): tell the user they're all set and can use `/devin` to delegate tasks. If `user_id` was not provided, suggest they add it later by re-running `/devin-setup`.
