#!/bin/bash
# Install the devin-mcp HTTP/SSE server as a macOS LaunchAgent so it starts
# automatically at login and restarts if it crashes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_LABEL="com.claude.devin-mcp"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_PATH="/tmp/devin-mcp.log"

# Locate node binary
NODE_BIN="$(which node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
  echo "Error: node not found in PATH. Please install Node.js first." >&2
  exit 1
fi

echo "Installing LaunchAgent..."
echo "  node:   $NODE_BIN"
echo "  server: $SCRIPT_DIR/index.js"
echo "  plist:  $PLIST_PATH"
echo "  log:    $LOG_PATH"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${SCRIPT_DIR}/index.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_PATH}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_PATH}</string>
</dict>
</plist>
PLIST

# Unload previous instance if running (ignore errors)
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "Done. Server is running at http://127.0.0.1:3742/sse"
echo ""
echo "Useful commands:"
echo "  Check status:  launchctl list | grep devin"
echo "  View logs:     tail -f $LOG_PATH"
echo "  Stop server:   launchctl unload $PLIST_PATH"
echo "  Start server:  launchctl load -w $PLIST_PATH"
