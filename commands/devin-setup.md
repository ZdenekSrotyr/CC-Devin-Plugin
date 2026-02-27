---
description: Configure Devin API credentials via interactive browser UI
allowed-tools: mcp__plugin_devin_devin-mcp__setup_devin
---

Call the `setup_devin` MCP tool immediately. Do not ask the user for anything first.

After calling the tool, tell the user:
- Their browser should have opened to http://localhost:3747
- They need to enter their Devin API Token and Organization ID
- API Token: https://app.devin.ai/settings/api-keys
- Org ID: https://app.devin.ai/settings/organization
- After saving in the browser, they should restart Claude
