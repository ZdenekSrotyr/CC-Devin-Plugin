---
description: Configure Devin API credentials via interactive browser UI
allowed-tools: Bash
---

Launch the interactive browser-based setup UI for the Devin plugin.

Tell the user to run these two commands in their own Terminal (not Claude's terminal):

**Step 1 — Find the setup script:**
```bash
find ~ -path "*/devin/*/setup-server.js" 2>/dev/null | head -1
```

**Step 2 — Start the setup UI (replace PATH with the result from step 1):**
```bash
node PATH
```

What will happen:
- A local web server starts on port 3747
- Their browser opens automatically to http://localhost:3747
- They enter Devin API Token (hidden) and Organization ID
- The UI tests the connection to the Devin API live
- On success, credentials are saved to ~/.config/claude-plugins/devin/config.json (chmod 600)
- The server shuts down automatically after saving
- After setup, they should restart Claude to pick up the new credentials

Where to find the credentials:
- API Token: https://app.devin.ai/settings/api-keys  (regenerate if previously exposed)
- Org ID: https://app.devin.ai/settings/organization
