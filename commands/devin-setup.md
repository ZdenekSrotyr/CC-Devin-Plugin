---
description: Configure Devin API credentials via interactive browser UI
allowed-tools: Bash
---

Launch the interactive browser-based setup UI for the Devin plugin.

First, find the setup-server.js script location using Bash:
```bash
find ~ -path "*/devin/*/setup-server.js" 2>/dev/null | head -1
```

Then tell the user to run this in their terminal (using the path found above):
```
node <path-to-setup-server.js>
```

For example if the plugin is cached at the default location:
```
node ~/.local-plugins/cache/knowledge-work-plugins/devin/0.1.0/scripts/setup-server.js
```

Explain what will happen:
- A local web server starts on their Mac at http://localhost:3747
- Their browser opens automatically with a setup UI
- They enter their Devin API Token (hidden input) and Organization ID
- The UI tests the credentials against the Devin API live
- On success, credentials are saved to ~/.config/claude-plugins/devin/config.json
- The server shuts down automatically after saving
- After setup, they should restart Claude to pick up the new credentials

Where to find the credentials:
- API Token: https://app.devin.ai/settings/api-keys
- Org ID: https://app.devin.ai/settings/organization
